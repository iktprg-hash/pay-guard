import { generateSessionToken } from "@/lib/security/token";
import {
  decryptLocalPayload,
  encryptLocalPayload,
  ensureLocalStorageCrypto,
  isEncryptedPayload,
} from "@/lib/security/local-crypto";
import type { ChatMessage, FinancialProfile } from "@/lib/types/financial";

const INDEX_KEY = "payguard-sessions-index";
const SESSION_PREFIX = "payguard-session-";

/** Legacy keys (single-session) */
const LEGACY_HISTORY_KEY = "payguard-chat-history";
const LEGACY_PROFILE_KEY = "payguard-chat-profile";
const LEGACY_SESSION_ID_KEY = "payguard-session-id";
const LEGACY_SESSION_TOKEN_KEY = "payguard-session-token";

export interface StoredChatSession {
  sessionId: string;
  sessionToken: string;
  locale: string;
  messages: StoredMessage[];
  profile: FinancialProfile;
  updatedAt: string;
  preview?: string;
}

export interface LocalSessionMeta {
  sessionId: string;
  sessionToken: string;
  locale: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
  hasRecommendation?: boolean;
}

interface SessionsIndex {
  activeSessionId: string;
  sessions: LocalSessionMeta[];
}

export interface SessionCredentials {
  sessionId: string;
  sessionToken: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  recommendation?: ChatMessage["recommendation"];
}

function sessionStorageKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

async function readSecureRaw(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return decryptLocalPayload(raw);
}

async function writeSecureRaw(key: string, plaintext: string): Promise<void> {
  if (typeof window === "undefined") return;
  await ensureLocalStorageCrypto();
  const stored = await encryptLocalPayload(plaintext);
  localStorage.setItem(key, stored);
}

async function readIndex(): Promise<SessionsIndex> {
  if (typeof window === "undefined") {
    return { activeSessionId: "", sessions: [] };
  }

  await migrateLegacyStorage();

  try {
    const raw = await readSecureRaw(INDEX_KEY);
    if (!raw) return { activeSessionId: "", sessions: [] };
    return JSON.parse(raw) as SessionsIndex;
  } catch {
    return { activeSessionId: "", sessions: [] };
  }
}

async function writeIndex(index: SessionsIndex): Promise<void> {
  if (typeof window === "undefined") return;
  await writeSecureRaw(INDEX_KEY, JSON.stringify(index));
}

function previewFromMessages(
  messages: StoredMessage[],
  locale: string
): string {
  const first = messages.find((m) => m.role === "user");
  if (first?.content) return first.content.slice(0, 120);
  return locale === "cs"
    ? "Nová konzultace"
    : locale === "ru"
      ? "Новая консультация"
      : "New consultation";
}

/** Migrace starého single-session formátu */
async function migrateLegacyStorage(): Promise<void> {
  if (typeof window === "undefined") return;

  const indexRaw = localStorage.getItem(INDEX_KEY);
  if (indexRaw) {
    if (!isEncryptedPayload(indexRaw)) {
      await writeSecureRaw(INDEX_KEY, indexRaw);
    }
    return;
  }

  const legacyRaw = localStorage.getItem(LEGACY_HISTORY_KEY);
  if (!legacyRaw) return;

  try {
    const legacy = JSON.parse(legacyRaw) as StoredChatSession;
    const sessionId =
      legacy.sessionId ??
      localStorage.getItem(LEGACY_SESSION_ID_KEY) ??
      crypto.randomUUID();
    const sessionToken =
      legacy.sessionToken ??
      localStorage.getItem(LEGACY_SESSION_TOKEN_KEY) ??
      generateSessionToken();

    const session: StoredChatSession = {
      ...legacy,
      sessionId,
      sessionToken,
      updatedAt: legacy.updatedAt ?? new Date().toISOString(),
      preview: previewFromMessages(legacy.messages ?? [], legacy.locale),
    };

    await writeSecureRaw(
      sessionStorageKey(sessionId),
      JSON.stringify(session)
    );
    await writeIndex({
      activeSessionId: sessionId,
      sessions: [
        {
          sessionId,
          sessionToken,
          locale: legacy.locale,
          updatedAt: session.updatedAt,
          preview:
            session.preview ??
            previewFromMessages(legacy.messages, legacy.locale),
          messageCount: legacy.messages?.length ?? 0,
        },
      ],
    });

    localStorage.removeItem(LEGACY_HISTORY_KEY);
    localStorage.removeItem(LEGACY_PROFILE_KEY);
    localStorage.removeItem(LEGACY_SESSION_ID_KEY);
    localStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  } catch {
    // ignore corrupt legacy
  }
}

export async function getOrCreateSessionCredentials(): Promise<SessionCredentials> {
  if (typeof window === "undefined") {
    return { sessionId: "", sessionToken: "" };
  }

  const index = await readIndex();

  if (index.activeSessionId) {
    const meta = index.sessions.find(
      (s) => s.sessionId === index.activeSessionId
    );
    if (meta) {
      return {
        sessionId: meta.sessionId,
        sessionToken: meta.sessionToken,
      };
    }
  }

  return createNewLocalSession("cs");
}

export async function setSessionCredentials(
  sessionId: string,
  sessionToken: string
): Promise<void> {
  if (typeof window === "undefined") return;

  const index = await readIndex();
  index.activeSessionId = sessionId;

  if (!index.sessions.some((s) => s.sessionId === sessionId)) {
    index.sessions.unshift({
      sessionId,
      sessionToken,
      locale: "cs",
      updatedAt: new Date().toISOString(),
      preview: "Consultation",
      messageCount: 0,
    });
  } else {
    index.sessions = index.sessions.map((s) =>
      s.sessionId === sessionId ? { ...s, sessionToken } : s
    );
  }

  await writeIndex(index);
}

export async function createNewLocalSession(
  locale: string
): Promise<SessionCredentials> {
  if (typeof window === "undefined") {
    return { sessionId: "", sessionToken: "" };
  }

  const sessionId = crypto.randomUUID();
  const sessionToken = generateSessionToken();
  const now = new Date().toISOString();
  const preview =
    locale === "cs"
      ? "Nová konzultace"
      : locale === "ru"
        ? "Новая консультация"
        : "New consultation";

  const session: StoredChatSession = {
    sessionId,
    sessionToken,
    locale,
    messages: [],
    profile: { availableFunds: 0, debts: [] },
    updatedAt: now,
    preview,
  };

  await writeSecureRaw(
    sessionStorageKey(sessionId),
    JSON.stringify(session)
  );

  const index = await readIndex();
  index.activeSessionId = sessionId;
  index.sessions.unshift({
    sessionId,
    sessionToken,
    locale,
    updatedAt: now,
    preview,
    messageCount: 0,
  });
  await writeIndex(index);

  return { sessionId, sessionToken };
}

export async function listLocalSessions(
  locale?: string
): Promise<LocalSessionMeta[]> {
  if (typeof window === "undefined") return [];
  const index = await readIndex();
  const sessions = [...index.sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return locale ? sessions.filter((s) => s.locale === locale) : sessions;
}

export async function loadStoredSession(
  sessionId: string
): Promise<StoredChatSession | null> {
  if (typeof window === "undefined") return null;

  try {
    const raw = await readSecureRaw(sessionStorageKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredChatSession;
  } catch {
    return null;
  }
}

export async function getOrCreateSessionId(): Promise<string> {
  return (await getOrCreateSessionCredentials()).sessionId;
}

export function serializeMessages(messages: ChatMessage[]): StoredMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    recommendation: m.recommendation,
  }));
}

export function deserializeMessages(stored: StoredMessage[]): ChatMessage[] {
  return stored.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    recommendation: m.recommendation,
  }));
}

export async function saveLocalHistory(
  locale: string,
  messages: ChatMessage[],
  profile: FinancialProfile,
  sessionId?: string
): Promise<void> {
  if (typeof window === "undefined") return;

  const index = await readIndex();
  const { sessionId: activeId, sessionToken } = sessionId
    ? {
        sessionId,
        sessionToken:
          index.sessions.find((s) => s.sessionId === sessionId)
            ?.sessionToken ?? generateSessionToken(),
      }
    : await getOrCreateSessionCredentials();

  const now = new Date().toISOString();
  const serialized = serializeMessages(messages);
  const preview = previewFromMessages(serialized, locale);

  const session: StoredChatSession = {
    sessionId: activeId,
    sessionToken,
    locale,
    messages: serialized,
    profile,
    updatedAt: now,
    preview,
  };

  await writeSecureRaw(
    sessionStorageKey(activeId),
    JSON.stringify(session)
  );

  index.activeSessionId = activeId;
  const meta: LocalSessionMeta = {
    sessionId: activeId,
    sessionToken,
    locale,
    updatedAt: now,
    preview,
    messageCount: messages.length,
    hasRecommendation: messages.some((m) => Boolean(m.recommendation)),
  };
  index.sessions = [
    meta,
    ...index.sessions.filter((s) => s.sessionId !== activeId),
  ];
  await writeIndex(index);
}

export async function importServerSession(
  session: StoredChatSession
): Promise<void> {
  if (typeof window === "undefined") return;

  const existing = await loadStoredSession(session.sessionId);
  const sessionToken =
    session.sessionToken ||
    existing?.sessionToken ||
    generateSessionToken();

  const stored: StoredChatSession = { ...session, sessionToken };

  await writeSecureRaw(
    sessionStorageKey(stored.sessionId),
    JSON.stringify(stored)
  );

  const index = await readIndex();
  const meta: LocalSessionMeta = {
    sessionId: stored.sessionId,
    sessionToken,
    locale: session.locale,
    updatedAt: session.updatedAt,
    preview:
      session.preview ??
      previewFromMessages(session.messages, session.locale),
    messageCount: session.messages.length,
    hasRecommendation: session.messages.some((m) => Boolean(m.recommendation)),
  };
  index.sessions = [
    meta,
    ...index.sessions.filter((s) => s.sessionId !== session.sessionId),
  ];
  if (!index.activeSessionId) index.activeSessionId = session.sessionId;
  await writeIndex(index);
}

/** Načte aktivní nebo konkrétní relaci z localStorage */
export async function loadLocalHistory(
  locale: string,
  sessionId?: string
): Promise<{
  messages: ChatMessage[];
  profile: FinancialProfile;
  sessionId: string;
  sessionToken: string;
} | null> {
  if (typeof window === "undefined") return null;

  const index = await readIndex();
  const targetId = sessionId ?? index.activeSessionId;
  if (!targetId) return null;

  const stored = await loadStoredSession(targetId);
  if (!stored || stored.locale !== locale) return null;

  await setSessionCredentials(stored.sessionId, stored.sessionToken);

  return {
    messages: deserializeMessages(stored.messages),
    profile: stored.profile,
    sessionId: stored.sessionId,
    sessionToken: stored.sessionToken,
  };
}

export async function clearAllLocalSessions(): Promise<void> {
  if (typeof window === "undefined") return;

  const index = await readIndex();
  for (const s of index.sessions) {
    localStorage.removeItem(sessionStorageKey(s.sessionId));
  }
  localStorage.removeItem(INDEX_KEY);
}

/** Nová relace — ponechá ostatní v indexu */
export async function clearLocalHistory(): Promise<void> {
  if (typeof window === "undefined") return;
  await createNewLocalSession("cs");
}

export async function removeLocalSession(sessionId: string): Promise<void> {
  if (typeof window === "undefined") return;

  localStorage.removeItem(sessionStorageKey(sessionId));
  const index = await readIndex();
  index.sessions = index.sessions.filter((s) => s.sessionId !== sessionId);
  if (index.activeSessionId === sessionId) {
    index.activeSessionId = index.sessions[0]?.sessionId ?? "";
  }
  await writeIndex(index);
}

/** Inicializace šifrování — volat při startu klienta */
export { ensureLocalStorageCrypto } from "@/lib/security/local-crypto";

/** Zašifruje staré plaintext záznamy v localStorage */
export async function migratePlaintextStorage(): Promise<void> {
  await ensureLocalStorageCrypto();
  if (typeof window === "undefined") return;

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SESSION_PREFIX) || key === INDEX_KEY) {
      keys.push(key);
    }
  }

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw && !isEncryptedPayload(raw)) {
      await writeSecureRaw(key, raw);
    }
  }
}
