import { describe, expect, it } from "vitest";
import { isStrongPassword } from "@/lib/auth/password";
import { mapSupabaseMessage } from "@/lib/auth/errors";

describe("isStrongPassword", () => {
  it("accepts valid passwords", () => {
    expect(isStrongPassword("Heslo123")).toBe(true);
    expect(isStrongPassword("Password1")).toBe(true);
  });

  it("rejects weak passwords", () => {
    expect(isStrongPassword("testpass123")).toBe(false);
    expect(isStrongPassword("short1A")).toBe(false);
    expect(isStrongPassword("NoDigitsHere")).toBe(false);
  });
});

describe("mapSupabaseMessage", () => {
  it("maps password policy errors", () => {
    expect(
      mapSupabaseMessage(
        "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz"
      )
    ).toBe("password_requirements");
  });

  it("maps rate limit errors", () => {
    expect(mapSupabaseMessage("email rate limit exceeded")).toBe(
      "supabase_email_rate_limited"
    );
    expect(mapSupabaseMessage("rate limit exceeded")).toBe("rate_limited");
  });

  it("maps email not confirmed", () => {
    expect(mapSupabaseMessage("Email not confirmed")).toBe("email_not_confirmed");
  });

  it("maps email taken", () => {
    expect(mapSupabaseMessage("User already registered")).toBe("email_taken");
  });

  it("maps invalid otp", () => {
    expect(mapSupabaseMessage("Token has expired or is invalid")).toBe(
      "invalid_otp"
    );
  });

  it("maps OTP signup disabled / unknown user", () => {
    expect(mapSupabaseMessage("Signups not allowed for otp")).toBe(
      "account_not_found"
    );
    expect(mapSupabaseMessage("User not found")).toBe("account_not_found");
  });
});
