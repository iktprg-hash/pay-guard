import { NextResponse } from "next/server";
import {
  loadLatestUserSession,
  loadSessionFromSupabase,
  saveSessionToSupabase,
} from "@/lib/chat/persistence";
import type { StoredMessage } from "@/lib/chat/storage";
import { withProProtection } from "@/lib/api/protected";
import { createClient } from "@/lib/supabase/server";
import {
  createAppError,
  respondWithError,
  respondWithValidationError,
  toApiResponse,
} from "@/lib/errors";
import { parseJsonBody, parseQueryParams } from "@/lib/api/parse-request";
import {
  historyGetLatestQuerySchema,
  historyGetSchema,
  historyPostSchema,
  normalizeProfile,
} from "@/lib/validation/schemas";

/** Uloží celou historii konverzace */
export const POST = withProProtection(
  async (request, { user }) => {
    try {
      const parsed = await parseJsonBody(request, historyPostSchema);
      if (!parsed.ok) return respondWithValidationError(parsed.error);

      const { sessionId, sessionToken, messages, profile, locale } = parsed.data;

      const supabase = await createClient();
      const saved = await saveSessionToSupabase(
        supabase,
        sessionId,
        sessionToken,
        messages as StoredMessage[],
        normalizeProfile(profile),
        locale,
        user.id
      );

      if (!saved) {
        return respondWithError("UNAUTHORIZED", { message: "Invalid session" });
      }

      return NextResponse.json({ ok: true, persisted: saved });
    } catch (error) {
      console.error("[api/chat/history POST]", error);
      return toApiResponse(
        createAppError("INTERNAL_ERROR", {
          message: "Failed to persist chat history",
          cause: error,
        })
      );
    }
  },
  { rateLimit: "history-write" }
);

/** Načte historii — ?latest=1 nebo ?sessionId= (auth + ownership) */
export const GET = withProProtection(
  async (request, { user }) => {
    const latestParam = request.nextUrl.searchParams.get("latest");

    if (latestParam === "1") {
      const latestQuery = parseQueryParams(request, historyGetLatestQuerySchema);
      if (!latestQuery.ok) return respondWithValidationError(latestQuery.error);

      const supabase = await createClient();
      const bundle = await loadLatestUserSession(supabase, user.id);
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
    if (!sessionQuery.ok) return respondWithValidationError(sessionQuery.error);

    try {
      const supabase = await createClient();
      const messages = await loadSessionFromSupabase(
        supabase,
        sessionQuery.data.sessionId,
        user.id
      );

      if (messages === null) {
        return respondWithError("UNAUTHORIZED", { message: "Invalid session" });
      }

      return NextResponse.json({ messages });
    } catch (error) {
      console.error("[api/chat/history GET]", error);
      return toApiResponse(
        createAppError("INTERNAL_ERROR", {
          message: "Failed to load chat history",
          cause: error,
        })
      );
    }
  },
  { rateLimit: "history-read" }
);
