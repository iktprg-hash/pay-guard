import { NextRequest, NextResponse } from "next/server";
import { loadUserSessionBundle } from "@/lib/chat/persistence";
import { requireProApiWithRateLimit } from "@/lib/api/pro-route-guard";
import { createClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/api/errors";
import { parseQueryParams } from "@/lib/api/parse-request";
import {
  emptyQuerySchema,
  sessionIdSchema,
} from "@/lib/validation/schemas";

type RouteContext = { params: Promise<{ sessionId: string }> };

/** GET — načte jednu konzultaci (zprávy + profil); token se nevrací klientovi */
export async function GET(request: NextRequest, context: RouteContext) {
  const guard = await requireProApiWithRateLimit(request, "sessions-read");
  if (!guard.ok) return guard.response;

  const query = parseQueryParams(request, emptyQuerySchema);
  if (!query.ok) return validationError(query.error);

  const { sessionId: rawSessionId } = await context.params;
  const parsedId = sessionIdSchema.safeParse(rawSessionId);
  if (!parsedId.success) return validationError(parsedId.error);

  const sessionId = parsedId.data;

  const supabase = await createClient();
  const bundle = await loadUserSessionBundle(supabase, sessionId, guard.user.id);
  if (!bundle) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(bundle);
}
