import { NextRequest, NextResponse } from "next/server";
import { loadUserSessionBundle } from "@/lib/chat/persistence";
import { requireProApiUser } from "@/lib/auth/require-pro";
import { createClient } from "@/lib/supabase/server";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { sessionIdSchema } from "@/lib/validation/schemas";

type RouteContext = { params: Promise<{ sessionId: string }> };

/** GET — načte jednu konzultaci (zprávy + profil); token se nevrací klientovi */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireProApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `sessions-get:${auth.user.id}:${ip}`,
    60,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const { sessionId: rawSessionId } = await context.params;
  const parsedId = sessionIdSchema.safeParse(rawSessionId);
  if (!parsedId.success) return validationError(parsedId.error);

  const sessionId = parsedId.data;

  const supabase = await createClient();
  const bundle = await loadUserSessionBundle(supabase, sessionId, auth.user.id);
  if (!bundle) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(bundle);
}
