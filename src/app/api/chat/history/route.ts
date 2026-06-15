import { NextRequest, NextResponse } from "next/server";
import {
  loadLatestUserSession,
  loadSessionFromSupabase,
  saveSessionToSupabase,
} from "@/lib/chat/persistence";
import type { StoredMessage } from "@/lib/chat/storage";
import { requireProApiWithRateLimit } from "@/lib/api/pro-route-guard";
import { createClient } from "@/lib/supabase/server";
import {
  internalServerError,
  unauthorizedError,
  validationError,
} from "@/lib/api/errors";
import { parseJsonBody, parseQueryParams } from "@/lib/api/parse-request";
import {
  historyGetLatestQuerySchema,
  historyGetSchema,
  historyPostSchema,
  normalizeProfile,
} from "@/lib/validation/schemas";

/** Uloží celou historii konverzace */
export async function POST(request: NextRequest) {
  const guard = await requireProApiWithRateLimit(request, "history-write");
  if (!guard.ok) return guard.response;

  try {
    const parsed = await parseJsonBody(request, historyPostSchema);
    if (!parsed.ok) return validationError(parsed.error);

    const { sessionId, sessionToken, messages, profile, locale } = parsed.data;

    const supabase = await createClient();
    const saved = await saveSessionToSupabase(
      supabase,
      sessionId,
      sessionToken,
      messages as StoredMessage[],
      normalizeProfile(profile),
      locale,
      guard.user.id
    );

    if (!saved) {
      return unauthorizedError("Invalid session");
    }

    return NextResponse.json({ ok: true, persisted: saved });
  } catch (error) {
    console.error("[api/chat/history POST]", error);
    return internalServerError("Failed to persist chat history");
  }
}

/** Načte historii — ?latest=1 nebo ?sessionId= (auth + ownership) */
export async function GET(request: NextRequest) {
  const guard = await requireProApiWithRateLimit(request, "history-read");
  if (!guard.ok) return guard.response;

  const latestParam = request.nextUrl.searchParams.get("latest");

  if (latestParam === "1") {
    const latestQuery = parseQueryParams(request, historyGetLatestQuerySchema);
    if (!latestQuery.ok) return validationError(latestQuery.error);

    const supabase = await createClient();
    const bundle = await loadLatestUserSession(supabase, guard.user.id);
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

  const sessionQuery = parseQueryParams(request, historyGetSchema);
  if (!sessionQuery.ok) return validationError(sessionQuery.error);

  try {
    const supabase = await createClient();
    const messages = await loadSessionFromSupabase(
      supabase,
      sessionQuery.data.sessionId,
      guard.user.id
    );

    if (messages === null) {
      return unauthorizedError("Invalid session");
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[api/chat/history GET]", error);
    return internalServerError("Failed to load chat history");
  }
}
