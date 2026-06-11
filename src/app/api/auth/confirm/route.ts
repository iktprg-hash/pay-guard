import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api/errors";
import { authErrorResponse } from "@/lib/auth/errors";
import { AUTH_CONFIRM_OTP_TYPES } from "@/lib/auth/confirm-types";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";

const codeSchema = z.object({
  code: z.string().min(1).max(512),
});

const tokenSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(AUTH_CONFIRM_OTP_TYPES),
});

/** Potvrzení e-mailu / PKCE — session cookies na serveru */
export async function POST(request: NextRequest) {
  const limited = await enforceAuthRateLimit(request, "confirm");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const codeParsed = codeSchema.safeParse(body);
  const tokenParsed = tokenSchema.safeParse(body);

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
