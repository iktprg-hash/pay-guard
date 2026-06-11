import type { EmailOtpType } from "@supabase/supabase-js";

/** OTP types accepted by /api/auth/confirm — minimal surface */
export const AUTH_CONFIRM_OTP_TYPES = [
  "signup",
  "magiclink",
  "recovery",
  "email",
] as const satisfies readonly EmailOtpType[];

export type AuthConfirmOtpType = (typeof AUTH_CONFIRM_OTP_TYPES)[number];
