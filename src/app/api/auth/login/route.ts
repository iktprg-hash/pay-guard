import { NextRequest, NextResponse } from "next/server";
import { validationError } from "@/lib/api/errors";
import { authErrorResponse } from "@/lib/auth/errors";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { parseJsonBody } from "@/lib/api/parse-request";
import { authLoginSchema } from "@/lib/validation/schemas";

/** Přihlášení heslem — session cookies nastaví server (spolehlivé pro proxy) */
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, authLoginSchema);
  if (!parsed.ok) return validationError(parsed.error);

  const limited = await enforceAuthRateLimit(request, "login", parsed.data.email);
  if (limited) return limited;

  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return authErrorResponse(error.message, 401);
  }

  return response;
}
