import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validationError, serviceUnavailable } from "@/lib/api/errors";
import { authProviderErrorResponse, isOpaqueOtpSendError } from "@/lib/auth/errors";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { parseJsonBody } from "@/lib/api/parse-request";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { authSendOtpSchema } from "@/lib/validation/schemas";

/** Odešle 6místný kód na e-mail — pouze existující účty (bez registrace heslem) */
export async function POST(request: NextRequest) {
  const ipLimited = await enforceAuthRateLimit(request, "send-otp");
  if (ipLimited) return ipLimited;

  const parsed = await parseJsonBody(request, authSendOtpSchema);
  if (!parsed.ok) return validationError(parsed.error);

  const limited = await enforceAuthRateLimit(
    request,
    "send-otp",
    parsed.data.email,
    { skipIp: true }
  );
  if (limited) return limited;

  const config = getSupabasePublicConfig();

  if (!config) {
    return serviceUnavailable("Supabase is not configured in .env.local");
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
