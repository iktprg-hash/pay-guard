import { NextRequest, NextResponse } from "next/server";
import { respondWithValidationError } from "@/lib/errors";
import { authErrorResponse, authProviderErrorResponse } from "@/lib/auth/errors";
import {
  canUseDevRegisterBypass,
  devRegisterWithPassword,
} from "@/lib/auth/dev-register";
import { applyPublicAuthRateLimit, type AppRouteContext } from "@/lib/api/protected";
import { isStrongPassword } from "@/lib/auth/password";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { authConfirmUrl } from "@/lib/site/url";
import { createServiceClient } from "@/lib/supabase/service";
import { parseJsonBody } from "@/lib/api/parse-request";
import { assertSupabaseConfigured } from "@/lib/supabase/guard";
import { authRegisterSchema } from "@/lib/validation/schemas";

const handleRegister = async (request: NextRequest) => {
  const parsed = await parseJsonBody(request, authRegisterSchema);
  if (!parsed.ok) return respondWithValidationError(parsed.error);

  if (!isStrongPassword(parsed.data.password)) {
    return authErrorResponse(
      "Password requirements not met",
      400,
      "password_requirements"
    );
  }

  const limited = await applyPublicAuthRateLimit(
    request,
    "register",
    parsed.data.email
  );
  if (!limited.ok) return limited.response;

  const locale = parsed.data.locale ?? "cs";
  const response = NextResponse.json({ ok: true, needsEmailConfirmation: false });
  const supabase = createSessionRouteClient(request, response);

  if (canUseDevRegisterBypass()) {
    const admin = createServiceClient()!;
    const result = await devRegisterWithPassword(admin, supabase, {
      email: parsed.data.email,
      password: parsed.data.password,
      locale,
    });

    if ("error" in result) {
      return authProviderErrorResponse(result.error, 400);
    }

    return response;
  }

  const emailRedirectTo = authConfirmUrl(request, locale);

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo,
      data: { locale },
    },
  });

  if (error) {
    return authProviderErrorResponse(error.message, 400);
  }

  if (!data.session) {
    return NextResponse.json({ ok: true, needsEmailConfirmation: true });
  }

  return response;
};

/** Registrace heslem — session cookies nastaví server */
export async function POST(request: NextRequest, _context: AppRouteContext) {
  const supabaseGuard = assertSupabaseConfigured();
  if (supabaseGuard) return supabaseGuard;

  return handleRegister(request);
}
