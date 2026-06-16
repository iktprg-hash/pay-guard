import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_CONFIRM_OTP_TYPES } from "@/lib/auth/confirm-types";

const enforceAuthRateLimit = vi.fn();
const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/auth/rate-limit", () => ({
  enforceAuthRateLimit: (...args: unknown[]) => enforceAuthRateLimit(...args),
}));

vi.mock("@/lib/auth/supabase-route", () => ({
  createSessionRouteClient: () => ({
    auth: { verifyOtp, exchangeCodeForSession },
  }),
}));

vi.mock("@/lib/supabase/guard", () => ({
  assertSupabaseConfigured: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  enforceAuthRateLimit.mockResolvedValue(null);
  verifyOtp.mockResolvedValue({ error: null });
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("POST /api/auth/confirm OTP types", () => {
  it("accepts allowed recovery type", async () => {
    const { POST } = await import("./confirm/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: "hash", type: "recovery" }),
      })
    );

    expect(res.status).toBe(200);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "recovery" });
  });

  it("rejects invite type", async () => {
    const { POST } = await import("./confirm/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: "hash", type: "invite" }),
      })
    );

    expect(res.status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("exports minimal OTP type list", () => {
    expect(AUTH_CONFIRM_OTP_TYPES).toEqual([
      "signup",
      "magiclink",
      "recovery",
      "email",
    ]);
    expect(AUTH_CONFIRM_OTP_TYPES).not.toContain("invite");
    expect(AUTH_CONFIRM_OTP_TYPES).not.toContain("email_change");
  });
});
