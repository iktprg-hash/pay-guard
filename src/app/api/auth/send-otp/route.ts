import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validationError, serviceUnavailable } from "@/lib/api/errors";
import { authErrorResponse, isOpaqueOtpSendError } from "@/lib/auth/errors";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { parseJsonBody } from "@/lib/api/parse-request";
import { authSendOtpSchema } from "@/lib/validation/schemas";

/** Odešle 6místný kód na e-mail — pouze existující účty (bez registrace heslem) */
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, authSendOtpSchema);
  if (!parsed.ok) return validationError(parsed.error);

  const limited = await enforceAuthRateLimit(
    request,
    "send-otp",
    parsed.data.email
  );
  if (limited) return limited;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("your-project")) {
    return serviceUnavailable("Supabase is not configured in .env.local");
  }

  const supabase = createClient(url, key);

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
    return authErrorResponse(error.message, 400);
  }

  return NextResponse.json({ ok: true });
}
