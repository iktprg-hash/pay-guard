import { describe, expect, it } from "vitest";
import {
  authProviderErrorResponse,
  mapSupabaseMessage,
  sanitiseAuthError,
} from "@/lib/auth/errors";

describe("sanitiseAuthError", () => {
  it("maps registration conflicts to opaque message", () => {
    expect(sanitiseAuthError("User already registered")).toBe(
      "Unable to complete registration. Please try signing in instead."
    );
  });

  it("maps rate limits to opaque message", () => {
    expect(sanitiseAuthError("Email rate limit exceeded")).toBe(
      "Too many attempts. Please wait a moment and try again."
    );
  });

  it("maps invalid credentials to opaque message", () => {
    expect(sanitiseAuthError("Invalid login credentials")).toBe(
      "Invalid credentials."
    );
  });

  it("maps email confirmation errors", () => {
    expect(sanitiseAuthError("Email not confirmed")).toBe(
      "Please confirm your email address."
    );
  });

  it("falls back to generic message", () => {
    expect(sanitiseAuthError("Something weird from provider")).toBe(
      "An error occurred. Please try again."
    );
  });
});

describe("authProviderErrorResponse", () => {
  it("returns opaque error text and stable code", async () => {
    const res = authProviderErrorResponse("User already registered", 400);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe("email_taken");
    expect(body.error).toBe(
      "Unable to complete registration. Please try signing in instead."
    );
    expect(body.error).not.toContain("already registered");
  });

  it("preserves explicit error codes", async () => {
    const res = authProviderErrorResponse(
      "email rate limit exceeded",
      429,
      "supabase_email_rate_limited"
    );
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe("supabase_email_rate_limited");
    expect(mapSupabaseMessage("email rate limit exceeded")).toBe(
      "supabase_email_rate_limited"
    );
    expect(body.error).toBe(
      "Too many attempts. Please wait a moment and try again."
    );
  });
});
