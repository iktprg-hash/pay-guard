import { NextRequest, NextResponse } from "next/server";
import { respondWithValidationError } from "@/lib/errors";
import { authErrorResponse, authProviderErrorResponse } from "@/lib/auth/errors";
import { applyPublicAuthRateLimit, type AppRouteContext } from "@/lib/api/protected";
import { isStrongPassword } from "@/lib/auth/password";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { parseJsonBody } from "@/lib/api/parse-request";
import { assertSupabaseConfigured } from "@/lib/supabase/guard";
import { authResetPasswordSchema } from "@/lib/validation/schemas";

const handleResetPassword = async (request: NextRequest) => {
  const parsed = await parseJsonBody(request, authResetPasswordSchema);
  if (!parsed.ok) return respondWithValidationError(parsed.error);

  if (!isStrongPassword(parsed.data.password)) {
    return authErrorResponse(
      "Password requirements not met",
      400,
      "password_requirements"
    );
  }

  const limited = await applyPublicAuthRateLimit(request, "reset-password");
  if (!limited.ok) return limited.response;

  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return authErrorResponse("Authentication required", 401);
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return authProviderErrorResponse(error.message, 400);
  }

  return response;
};

/** Nastaví nové heslo po recovery odkazu */
export async function POST(request: NextRequest, _context: AppRouteContext) {
  const supabaseGuard = assertSupabaseConfigured();
  if (supabaseGuard) return supabaseGuard;

  return handleResetPassword(request);
}
