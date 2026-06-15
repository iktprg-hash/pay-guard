import { NextRequest, NextResponse } from "next/server";
import { validationError } from "@/lib/api/errors";
import { authErrorResponse } from "@/lib/auth/errors";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { parseJsonBody } from "@/lib/api/parse-request";
import {
  authConfirmCodeSchema,
  authConfirmTokenSchema,
} from "@/lib/validation/schemas";
import { assertSupabaseConfigured } from "@/lib/supabase/guard";

/** Potvrzení e-mailu / PKCE — session cookies na serveru */
export async function POST(request: NextRequest) {
  const supabaseGuard = assertSupabaseConfigured();
  if (supabaseGuard) return supabaseGuard;

  const limited = await enforceAuthRateLimit(request, "confirm");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const codeParsed = authConfirmCodeSchema.safeParse(body);
  const tokenParsed = authConfirmTokenSchema.safeParse(body);

  if (!codeParsed.success && !tokenParsed.success) {
    return validationError(
      codeParsed.success ? tokenParsed.error! : codeParsed.error
    );
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  if (tokenParsed.success) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenParsed.data.token_hash,
      type: tokenParsed.data.type,
    });
    if (error) return authErrorResponse(error.message, 401);
    return response;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(
    codeParsed.data!.code
  );
  if (error) return authErrorResponse(error.message, 401);

  return response;
}
