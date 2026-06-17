import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireApiUser = vi.fn();
const runPriorityEngine = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: () => requireApiUser(),
}));

vi.mock("@/lib/security/authenticated-rate-limit", () => ({
  AUTHENTICATED_RATE_LIMITS: {
    prioritize: { limit: 60, windowMs: 60_000 },
  },
  checkAuthenticatedRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 1, resetAt: 0 }),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/services/priorityEngine", () => ({
  runPriorityEngine: (...args: unknown[]) => runPriorityEngine(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue({ user: { id: "user-1" } });
  runPriorityEngine.mockReturnValue({
    summary: "ok",
    recommendations: [],
    warnings: [],
    remainingFunds: 0,
    lifeBuffer: 0,
    lifeBufferPercent: 0,
  });
});

describe("POST /api/prioritize", () => {
  it("returns 401 when unauthenticated", async () => {
    requireApiUser.mockResolvedValue({
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { availableFunds: 1000, debts: [] },
          locale: "cs",
        }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      })
    );

    expect(res.status).toBe(400);
    expect(runPriorityEngine).not.toHaveBeenCalled();
  });

  it("returns 422 when profile lacks minimum recommendation data", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { availableFunds: 1000, debts: [] },
          locale: "ru",
        }),
      })
    );

    expect(res.status).toBe(422);
    expect(runPriorityEngine).not.toHaveBeenCalled();
  });

  it("runs engine for valid payload with funds and debt", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            availableFunds: 1000,
            debts: [
              {
                id: "1",
                creditor: "ČEZ",
                amount: 500,
                category: "utilities",
              },
            ],
          },
          locale: "ru",
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(runPriorityEngine).toHaveBeenCalled();
  });
});
