import { NextRequest, NextResponse } from "next/server";
import { validationError } from "@/lib/api/errors";
import { authErrorResponse } from "@/lib/auth/errors";
import {
  canUseDevRegisterBypass,
  devRegisterWithPassword,
} from "@/lib/auth/dev-register";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { isStrongPassword } from "@/lib/auth/password";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { authConfirmUrl } from "@/lib/site/url";
import { createServiceClient } from "@/lib/supabase/service";
import { parseJsonBody } from "@/lib/api/parse-request";
import { assertSupabaseConfigured } from "@/lib/supabase/guard";
import { authRegisterSchema } from "@/lib/validation/schemas";

/** Registrace heslem — session cookies nastaví server */
export async function POST(request: NextRequest) {
  const supabaseGuard = assertSupabaseConfigured();
  if (supabaseGuard) return supabaseGuard;

  const parsed = await parseJsonBody(request, authRegisterSchema);
  if (!parsed.ok) return validationError(parsed.error);

  if (!isStrongPassword(parsed.data.password)) {
    return authErrorResponse(
      "Password requirements not met",
      400,
      "password_requirements"
    );
  }

  const limited = await enforceAuthRateLimit(
    request,
    "register",
    parsed.data.email
  );
  if (limited) return limited;

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
      return authErrorResponse(result.error, 400);
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
    return authErrorResponse(error.message, 400);
  }

  if (!data.session) {
    return NextResponse.json({ ok: true, needsEmailConfirmation: true });
  }

  return response;
}
