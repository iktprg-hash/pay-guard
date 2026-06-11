import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const signInWithOtp = vi.fn();

vi.mock("@/lib/auth/rate-limit", () => ({
  enforceAuthRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { signInWithOtp },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  signInWithOtp.mockResolvedValue({ error: null });
});

describe("POST /api/auth/send-otp", () => {
  it("does not create passwordless accounts (shouldCreateUser: false)", async () => {
    const { POST } = await import("./send-otp/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@test.cz" }),
      })
    );

    expect(res.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@test.cz",
      options: { shouldCreateUser: false },
    });
  });

  it("returns ok for unknown email without revealing enumeration", async () => {
    signInWithOtp.mockResolvedValue({
      error: { message: "Signups not allowed for otp" },
    });

    const { POST } = await import("./send-otp/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "missing@test.cz" }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; code?: string };
    expect(body.ok).toBe(true);
    expect(body.code).toBeUndefined();
  });
});
