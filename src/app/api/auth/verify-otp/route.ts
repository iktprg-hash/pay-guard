import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api/errors";
import { authErrorResponse } from "@/lib/auth/errors";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";

const otpSchema = z.object({
  email: z.string().email().max(320),
  token: z.string().regex(/^\d{6}$/),
});

/** Ověření e-mailového kódu — bez PKCE redirectu */
export async function POST(request: NextRequest) {
  const parsed = otpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  const limited = await enforceAuthRateLimit(
    request,
    "verify-otp",
    parsed.data.email
  );
  if (limited) return limited;

  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error) {
    return authErrorResponse(error.message, 401);
  }

  return response;
}
