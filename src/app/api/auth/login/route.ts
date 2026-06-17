import { NextRequest, NextResponse } from "next/server";
import { respondWithValidationError } from "@/lib/errors";
import { authErrorResponse, authProviderErrorResponse } from "@/lib/auth/errors";
import { applyPublicAuthRateLimit, type AppRouteContext } from "@/lib/api/protected";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { parseJsonBody } from "@/lib/api/parse-request";
import { assertSupabaseConfigured } from "@/lib/supabase/guard";
import { authLoginSchema } from "@/lib/validation/schemas";

const handleLogin = async (request: NextRequest) => {
  const parsed = await parseJsonBody(request, authLoginSchema);
  if (!parsed.ok) return respondWithValidationError(parsed.error);

  const limited = await applyPublicAuthRateLimit(
    request,
    "login",
    parsed.data.email
  );
  if (!limited.ok) return limited.response;

  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return authProviderErrorResponse(error.message, 401);
  }

  return response;
};

/** Přihlášení heslem — session cookies nastaví server (spolehlivé pro proxy) */
export async function POST(request: NextRequest, _context: AppRouteContext) {
  const supabaseGuard = assertSupabaseConfigured();
  if (supabaseGuard) return supabaseGuard;

  return handleLogin(request);
}
