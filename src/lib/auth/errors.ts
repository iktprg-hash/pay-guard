import { NextResponse } from "next/server";
import { isSupabaseEmailRateLimit } from "@/lib/auth/rate-limit";

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "email_taken"
  | "weak_password"
  | "password_requirements"
  | "invalid_otp"
  | "account_not_found"
  | "rate_limited"
  | "supabase_email_rate_limited"
  | "auth_failed"
  | "not_configured";

/** Maps Supabase auth error messages to safe, opaque client messages. */
export function sanitiseAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) {
    return "Unable to complete registration. Please try signing in instead.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (m.includes("invalid") || m.includes("not found") || m.includes("wrong")) {
    return "Invalid credentials.";
  }
  if (m.includes("email") && m.includes("confirm")) {
    return "Please confirm your email address.";
  }
  return "An error occurred. Please try again.";
}

export function mapSupabaseMessage(message: string): AuthErrorCode {
  const msg = message.toLowerCase();

  if (msg.includes("email rate limit")) return "supabase_email_rate_limited";
  if (msg.includes("rate limit")) return "rate_limited";
  if (msg.includes("email not confirmed")) return "email_not_confirmed";
  if (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user already registered")
  ) {
    return "email_taken";
  }
  if (
    msg.includes("password should") ||
    (msg.includes("password") &&
      (msg.includes("character") || msg.includes("at least")))
  ) {
    return "password_requirements";
  }
  if (
    msg.includes("invalid login") ||
    msg.includes("invalid credentials") ||
    msg.includes("invalid email or password")
  ) {
    return "invalid_credentials";
  }
  if (
    msg.includes("signups not allowed") ||
    msg.includes("user not found") ||
    msg.includes("no user found")
  ) {
    return "account_not_found";
  }
  if (msg.includes("otp") || msg.includes("token has expired")) {
    return "invalid_otp";
  }

  return "auth_failed";
}

/** OTP send errors that must not reveal whether the email exists */
export function isOpaqueOtpSendError(message: string): boolean {
  const code = mapSupabaseMessage(message);
  return code === "account_not_found" || code === "auth_failed";
}

/** Safe auth error from a raw Supabase/provider message. */
export function authProviderErrorResponse(
  rawMessage: string,
  status: number,
  code?: AuthErrorCode
) {
  return authErrorResponse(
    sanitiseAuthError(rawMessage),
    status,
    code ?? mapSupabaseMessage(rawMessage)
  );
}

/** Bezpečná auth chyba — opaque message + stable code (no raw Supabase text). */
export function authErrorResponse(
  message: string,
  status: number,
  code?: AuthErrorCode
) {
  return NextResponse.json(
    {
      code: code ?? mapSupabaseMessage(message),
      error: message,
    },
    { status }
  );
}

export function mapAuthCodeToMessage(
  code: AuthErrorCode | undefined,
  t: (key: string) => string,
  fallbackError?: string
): string {
  if (code === "supabase_email_rate_limited") {
    return t("errors.supabaseEmailRateLimited");
  }

  if (isSupabaseEmailRateLimit(fallbackError)) {
    return t("errors.supabaseEmailRateLimited");
  }

  switch (code) {
    case "email_not_confirmed":
      return t("errors.emailNotConfirmed");
    case "email_taken":
      return t("errors.emailTaken");
    case "weak_password":
    case "password_requirements":
      return t("errors.passwordRequirements");
    case "invalid_otp":
      return t("errors.invalidEmailCode");
    case "account_not_found":
      return t("errors.accountNotFound");
    case "invalid_credentials":
      return t("errors.invalidCredentials");
    case "rate_limited":
      return t("errors.rateLimited");
    default:
      return fallbackError ?? t("errors.generic");
  }
}
