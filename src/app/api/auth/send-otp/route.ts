import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { respondWithError, respondWithValidationError } from "@/lib/errors";
import { authProviderErrorResponse, isOpaqueOtpSendError } from "@/lib/auth/errors";
import { applyPublicAuthRateLimit, type AppRouteContext } from "@/lib/api/protected";
import { parseJsonBody } from "@/lib/api/parse-request";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { authSendOtpSchema } from "@/lib/validation/schemas";

/** Odešle 6místný kód na e-mail — pouze existující účty (bez registrace heslem) */
export async function POST(request: NextRequest, _context: AppRouteContext) {
  const ipLimited = await applyPublicAuthRateLimit(request, "send-otp");
  if (!ipLimited.ok) return ipLimited.response;

  const parsed = await parseJsonBody(request, authSendOtpSchema);
  if (!parsed.ok) return respondWithValidationError(parsed.error);

  const limited = await applyPublicAuthRateLimit(
    request,
    "send-otp",
    parsed.data.email,
    { skipIp: true }
  );
  if (!limited.ok) return limited.response;

  const config = getSupabasePublicConfig();

  if (!config) {
    return respondWithError("INTERNAL_ERROR", {
      statusCode: 503,
      message: "Supabase is not configured in .env.local",
    });
  }

  const supabase = createClient(config.url, config.anonKey);

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    if (isOpaqueOtpSendError(error.message)) {
      console.warn("[api/auth/send-otp] opaque failure:", error.message);
      return NextResponse.json({ ok: true });
    }
    console.error("[api/auth/send-otp]", error.message);
    return authProviderErrorResponse(error.message, 400);
  }

  return NextResponse.json({ ok: true });
}
