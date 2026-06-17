import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { respondWithError } from "@/lib/errors";

const requireProApiUser = vi.fn();
const saveSessionToSupabase = vi.fn();

vi.mock("@/lib/auth/require-pro", () => ({
  requireProApiUser: () => requireProApiUser(),
}));

vi.mock("@/lib/chat/persistence", () => ({
  saveSessionToSupabase: (...args: unknown[]) => saveSessionToSupabase(...args),
  loadLatestUserSession: vi.fn(),
  loadSessionFromSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/security/pro-rate-limit", () => ({
  checkProRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 1, resetAt: 0 }),
  PRO_RATE_LIMITS: { "history-write": 30, "history-read": 30 },
}));

vi.mock("@/lib/security/rateLimit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

const sessionId = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
  requireProApiUser.mockResolvedValue({ user: { id: "user-1" } });
  saveSessionToSupabase.mockResolvedValue(true);
});

describe("POST /api/chat/history", () => {
  it("returns 403 when user is not Pro", async () => {
    requireProApiUser.mockResolvedValue({
      error: respondWithError("PRO_REQUIRED"),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken: "a".repeat(32),
          locale: "cs",
          messages: [],
          profile: { availableFunds: 0, debts: [] },
        }),
      })
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad",
      })
    );

    expect(res.status).toBe(400);
    expect(saveSessionToSupabase).not.toHaveBeenCalled();
  });
});
