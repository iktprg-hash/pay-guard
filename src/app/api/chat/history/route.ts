import { NextRequest, NextResponse } from "next/server";
import {
  loadLatestUserSession,
  loadSessionFromSupabase,
  saveSessionToSupabase,
} from "@/lib/chat/persistence";
import type { StoredMessage } from "@/lib/chat/storage";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimitError,
  unauthorizedError,
  validationError,
} from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import {
  historyGetSchema,
  historyPostSchema,
  normalizeProfile,
} from "@/lib/validation/schemas";

/** Uloží celou historii konverzace */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(`history-post:${auth.user.id}:${ip}`, 30, 60_000);
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const body = await request.json();
    const parsed = historyPostSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { sessionId, sessionToken, messages, profile, locale } = parsed.data;

    const supabase = await createClient();
    const saved = await saveSessionToSupabase(
      supabase,
      sessionId,
      sessionToken,
      messages as StoredMessage[],
      normalizeProfile(profile),
      locale,
      auth.user.id
    );

    if (!saved) {
      return unauthorizedError("Invalid session");
    }

    return NextResponse.json({ ok: true, persisted: saved });
  } catch (error) {
    console.error("[api/chat/history POST]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** Načte historii — ?latest=1 nebo ?sessionId= (auth + ownership) */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(`history-get:${auth.user.id}:${ip}`, 30, 60_000);
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const latest = request.nextUrl.searchParams.get("latest") === "1";

  if (latest) {
    const supabase = await createClient();
    const bundle = await loadLatestUserSession(supabase, auth.user.id);
    if (!bundle) {
      return NextResponse.json({ messages: [], profile: null, session: null });
    }
    return NextResponse.json({
      messages: bundle.messages,
      profile: bundle.profile,
      locale: bundle.locale,
      session: { sessionId: bundle.sessionId },
    });
  }

  const parsed = historyGetSchema.safeParse({
    sessionId: request.nextUrl.searchParams.get("sessionId"),
  });

  if (!parsed.success) return validationError(parsed.error);

  try {
    const supabase = await createClient();
    const messages = await loadSessionFromSupabase(
      supabase,
      parsed.data.sessionId,
      auth.user.id
    );

    if (messages === null) {
      return unauthorizedError("Invalid session");
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[api/chat/history GET]", error);
    return NextResponse.json({ messages: [] }, { status: 500 });
  }
}
