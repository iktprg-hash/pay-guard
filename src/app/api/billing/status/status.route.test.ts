import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireApiUser = vi.fn();
const getSubscriptionStatus = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: () => requireApiUser(),
}));

vi.mock("@/lib/stripe", () => ({
  getSubscriptionStatus: (...args: unknown[]) => getSubscriptionStatus(...args),
}));

vi.mock("@/lib/security/authenticated-rate-limit", () => ({
  AUTHENTICATED_RATE_LIMITS: {},
  checkAuthenticatedRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 1, resetAt: 0 }),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue({ user: { id: "user-1" } });
  getSubscriptionStatus.mockResolvedValue({
    tier: "pro",
    isActive: true,
    expiresAt: "2027-01-01T00:00:00.000Z",
    testMode: true,
  });
});

describe("GET /api/billing/status", () => {
  it("returns 401 when unauthenticated", async () => {
    requireApiUser.mockResolvedValue({
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    });

    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://127.0.0.1:3000/api/billing/status")
    );

    expect(res.status).toBe(401);
  });

  it("returns subscription status", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://127.0.0.1:3000/api/billing/status")
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tier: string;
      isActive: boolean;
      testMode: boolean;
    };
    expect(body.tier).toBe("pro");
    expect(body.isActive).toBe(true);
    expect(body.testMode).toBe(true);
  });
});
