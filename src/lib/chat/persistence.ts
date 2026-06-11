import type { SupabaseClient } from "@supabase/supabase-js";
import { registerSession, validateSessionToken } from "@/lib/security/session";
import { requireServiceClient } from "@/lib/supabase/service-health";
import { generateSessionToken } from "@/lib/security/token";
import type { StoredMessage } from "@/lib/chat/storage";
import {
  assignDebtsToUser,
  loadSessionDebts,
  sessionProfilePayload,
  syncSessionDebts,
} from "@/lib/debts/repository";
import type {
  FinancialProfile,
  PrioritizationResult,
} from "@/lib/types/financial";
import { getCurrency } from "@/lib/financial/locale-config";
import type { Locale } from "@/i18n/routing";

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("your-project"));
}

function profileFromRow(
  profileData: FinancialProfile & { locale?: string } | null | undefined,
  debts: FinancialProfile["debts"]
): FinancialProfile {
  const p = profileData as FinancialProfile | undefined;
  return {
    availableFunds: p?.availableFunds ?? 0,
    monthlyIncome: p?.monthlyIncome,
    monthlyExpenses: p?.monthlyExpenses,
    incomeStability: p?.incomeStability,
    debts,
  };
}

function attachRecommendation(
  messages: StoredMessage[],
  recommendation: PrioritizationResult | null | undefined
): StoredMessage[] {
  if (!recommendation || messages.length === 0) return messages;

  const idx = [...messages]
    .reverse()
    .findIndex(
      (m) =>
        m.role === "assistant" &&
        (m.content === recommendation.summary || m.recommendation)
    );

  if (idx >= 0) {
    const realIdx = messages.length - 1 - idx;
    const next = [...messages];
    next[realIdx] = { ...next[realIdx], recommendation };
    return next;
  }

  return messages;
}

function lastRecommendation(
  messages: StoredMessage[]
): PrioritizationResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].recommendation) return messages[i].recommendation!;
  }
  return null;
}

function sessionPreview(messages: StoredMessage[], locale?: string): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser?.content) {
    return firstUser.content.slice(0, 120);
  }
  return locale ? `Consultation (${locale})` : "Consultation";
}

export async function ensureSessionAccess(
  supabase: SupabaseClient,
  sessionId: string,
  sessionToken: string,
  userId?: string | null
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  const valid = await validateSessionToken(sessionId, sessionToken);
  if (valid) {
    if (userId) {
      const { data } = await supabase
        .from("financial_sessions")
        .select("user_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (data?.user_id && data.user_id !== userId) return false;
    }
    return true;
  }

  return registerSession(sessionId, sessionToken, userId);
}

/** Propojí anonymní relaci s uživatelem — service role (RLS 002 skrývá user_id IS NULL) */
export async function claimSessionForUser(
  sessionId: string,
  sessionToken: string,
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const valid = await validateSessionToken(sessionId, sessionToken);
  if (!valid) return false;

  const admin = requireServiceClient();
  if (!admin) return false;

  try {
    const { data: existing } = await admin
      .from("financial_sessions")
      .select("user_id")
      .eq("id", sessionId)
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!existing) return false;
    if (existing.user_id === userId) return true;
    if (existing.user_id !== null) return false;

    const { data: updated, error: sessionError } = await admin
      .from("financial_sessions")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("session_token", sessionToken)
      .is("user_id", null)
      .select("id")
      .maybeSingle();

    if (sessionError || !updated) return false;

    await admin
      .from("chat_messages")
      .update({ user_id: userId })
      .eq("session_id", sessionId);

    await assignDebtsToUser(admin, sessionId, userId);

    return true;
  } catch {
    return false;
  }
}

export async function createUserSession(
  supabase: SupabaseClient,
  userId: string,
  locale: string
): Promise<{ sessionId: string; sessionToken: string } | null> {
  if (!isSupabaseConfigured()) return null;

  const sessionId = crypto.randomUUID();
  const sessionToken = generateSessionToken();
  const now = new Date().toISOString();

  try {
    const { error } = await supabase.from("financial_sessions").insert({
      id: sessionId,
      session_token: sessionToken,
      user_id: userId,
      profile_data: { locale, availableFunds: 0 },
      available_funds: 0,
      updated_at: now,
    });

    if (error) return null;
    return { sessionId, sessionToken };
  } catch {
    return null;
  }
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
  hasRecommendation: boolean;
  locale: string;
}

async function verifySessionOwnedByUser(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("financial_sessions")
      .select("user_id")
      .eq("id", sessionId)
      .maybeSingle();
    return data?.user_id === userId;
  } catch {
    return false;
  }
}

export async function listUserSessions(
  supabase: SupabaseClient,
  userId: string
): Promise<SessionSummary[]> {
  if (!isSupabaseConfigured()) return [];

  try {

    const { data: sessions, error } = await supabase
      .from("financial_sessions")
      .select(
        "id, profile_data, recommendation, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error || !sessions?.length) return [];

    const ids = sessions.map((s) => s.id);

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("session_id, role, content, created_at")
      .in("session_id", ids)
      .order("created_at", { ascending: true });

    const countMap = new Map<string, number>();
    const previewMap = new Map<string, string>();

    for (const msg of messages ?? []) {
      countMap.set(msg.session_id, (countMap.get(msg.session_id) ?? 0) + 1);
      if (msg.role === "user" && !previewMap.has(msg.session_id)) {
        previewMap.set(msg.session_id, String(msg.content).slice(0, 120));
      }
    }

    return sessions.map((s) => {
        const profileData = s.profile_data as { locale?: string } | null;
        const locale = profileData?.locale ?? "cs";
        return {
          id: s.id,
          createdAt: s.created_at,
          updatedAt: s.updated_at ?? s.created_at,
          preview:
            previewMap.get(s.id) ??
            sessionPreview([], locale),
          messageCount: countMap.get(s.id) ?? 0,
          hasRecommendation: Boolean(s.recommendation),
          locale,
        };
      });
  } catch {
    return [];
  }
}

export async function saveSessionToSupabase(
  supabase: SupabaseClient,
  sessionId: string,
  sessionToken: string | undefined,
  messages: StoredMessage[],
  profile: FinancialProfile,
  locale: string,
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  if (sessionToken) {
    const allowed = await ensureSessionAccess(
      supabase,
      sessionId,
      sessionToken,
      userId
    );
    if (!allowed) return false;
  } else if (!(await verifySessionOwnedByUser(supabase, sessionId, userId))) {
    return false;
  }

  try {
    const now = new Date().toISOString();
    const recommendation = lastRecommendation(messages);

    const row: Record<string, unknown> = {
      id: sessionId,
      user_id: userId,
      available_funds: profile.availableFunds,
      monthly_income: profile.monthlyIncome ?? null,
      monthly_expenses: profile.monthlyExpenses ?? null,
      income_stability: profile.incomeStability ?? null,
      profile_data: sessionProfilePayload(profile, locale),
      recommendation: recommendation ?? null,
      updated_at: now,
    };
    if (sessionToken) {
      row.session_token = sessionToken;
    }

    const { error: sessionError } = await supabase
      .from("financial_sessions")
      .upsert(row, { onConflict: "id" });

    if (sessionError) return false;

    const debtsSynced = await syncSessionDebts(
      supabase,
      sessionId,
      userId,
      profile.debts,
      getCurrency(locale as Locale)
    );
    if (!debtsSynced) return false;

    const recent = messages.slice(-100);
    const rows = recent
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({
        id: msg.id,
        session_id: sessionId,
        user_id: userId,
        role: msg.role,
        content: msg.content,
        created_at: msg.timestamp,
        metadata: msg.recommendation ? { recommendation: msg.recommendation } : {},
      }));

    if (rows.length > 0) {
      const { error: messagesError } = await supabase
        .from("chat_messages")
        .upsert(rows, { onConflict: "id" });
      if (messagesError) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function loadSessionFromSupabase(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  sessionToken?: string
): Promise<StoredMessage[] | null> {
  if (!isSupabaseConfigured()) return null;

  if (sessionToken) {
    const allowed = await ensureSessionAccess(
      supabase,
      sessionId,
      sessionToken,
      userId
    );
    if (!allowed) return null;
  } else if (!(await verifySessionOwnedByUser(supabase, sessionId, userId))) {
    return null;
  }

  return loadMessagesForSession(supabase, sessionId, userId);
}

async function loadMessagesForSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<StoredMessage[] | null> {
  try {

    const { data: session } = await supabase
      .from("financial_sessions")
      .select("recommendation, user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session || session.user_id !== userId) return null;

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at, metadata")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) return null;
    if (!data?.length) return [];

    const messages: StoredMessage[] = data.map((row) => {
      const meta = row.metadata as { recommendation?: PrioritizationResult };
      return {
        id: row.id,
        role: row.role as StoredMessage["role"],
        content: row.content,
        timestamp: row.created_at,
        recommendation: meta?.recommendation,
      };
    });

    return attachRecommendation(
      messages,
      session.recommendation as PrioritizationResult | null
    );
  } catch {
    return null;
  }
}

export interface UserSessionBundle {
  sessionId: string;
  messages: StoredMessage[];
  profile: FinancialProfile;
  locale: string;
  updatedAt: string;
  preview: string;
}

export async function loadUserSessionBundle(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<UserSessionBundle | null> {
  if (!isSupabaseConfigured()) return null;

  try {

    const { data: session, error } = await supabase
      .from("financial_sessions")
      .select(
        "id, profile_data, recommendation, created_at, updated_at, user_id"
      )
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !session) return null;

    const messages = await loadMessagesForSession(supabase, sessionId, userId);
    if (messages === null) return null;

    const profileData = session.profile_data as FinancialProfile & {
      locale?: string;
    };
    const locale = profileData?.locale ?? "cs";
    let debts = await loadSessionDebts(supabase, sessionId);
    if (debts.length === 0 && profileData?.debts?.length) {
      debts = profileData.debts;
    }
    const withReco = attachRecommendation(
      messages ?? [],
      session.recommendation as PrioritizationResult | null
    );

    return {
      sessionId: session.id,
      messages: withReco,
      profile: profileFromRow(profileData, debts),
      locale,
      updatedAt: session.updated_at ?? session.created_at,
      preview: sessionPreview(withReco, locale),
    };
  } catch {
    return null;
  }
}

/** Načte poslední relaci přihlášeného uživatele */
export async function loadLatestUserSession(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSessionBundle | null> {
  if (!isSupabaseConfigured()) return null;

  try {

    const { data: session, error } = await supabase
      .from("financial_sessions")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !session) return null;

    return loadUserSessionBundle(supabase, session.id, userId);
  } catch {
    return null;
  }
}

/** Push local session to server if server is older or missing */
export async function upsertLocalSessionToServer(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  sessionToken: string,
  messages: StoredMessage[],
  profile: FinancialProfile,
  locale: string,
  localUpdatedAt: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { data: existing } = await supabase
      .from("financial_sessions")
      .select("updated_at, user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (existing?.user_id && existing.user_id !== userId) return false;

    const serverTime = existing?.updated_at
      ? new Date(existing.updated_at).getTime()
      : 0;
    const localTime = new Date(localUpdatedAt).getTime();

    if (existing && serverTime >= localTime) return true;

    return saveSessionToSupabase(
      supabase,
      sessionId,
      sessionToken,
      messages,
      profile,
      locale,
      userId
    );
  } catch {
    return false;
  }
}
