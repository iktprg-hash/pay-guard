import { NextRequest, NextResponse } from "next/server";
import { respondWithValidationError } from "@/lib/errors";
import { authProviderErrorResponse } from "@/lib/auth/errors";
import { applyPublicAuthRateLimit, type AppRouteContext } from "@/lib/api/protected";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { parseJsonBody } from "@/lib/api/parse-request";
import { assertSupabaseConfigured } from "@/lib/supabase/guard";
import { authVerifyOtpSchema } from "@/lib/validation/schemas";

const handleVerifyOtp = async (request: NextRequest) => {
  const parsed = await parseJsonBody(request, authVerifyOtpSchema);
  if (!parsed.ok) return respondWithValidationError(parsed.error);

  const limited = await applyPublicAuthRateLimit(
    request,
    "verify-otp",
    parsed.data.email
  );
  if (!limited.ok) return limited.response;

  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error) {
    return authProviderErrorResponse(error.message, 401);
  }

  return response;
};

/** Ověření e-mailového kódu — bez PKCE redirectu */
export async function POST(request: NextRequest, _context: AppRouteContext) {
  const supabaseGuard = assertSupabaseConfigured();
  if (supabaseGuard) return supabaseGuard;

  return handleVerifyOtp(request);
}
