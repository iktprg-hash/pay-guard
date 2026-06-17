import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireApiUser = vi.fn();
const getUserGrokConsent = vi.fn();
const setUserGrokConsent = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: () => requireApiUser(),
}));

vi.mock("@/lib/auth/grok-consent", () => ({
  getUserGrokConsent: (...args: unknown[]) => getUserGrokConsent(...args),
  setUserGrokConsent: (...args: unknown[]) => setUserGrokConsent(...args),
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
});

describe("/api/auth/grok-consent", () => {
  it("GET returns consent status", async () => {
    getUserGrokConsent.mockResolvedValue(true);

    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://127.0.0.1:3000/api/auth/grok-consent"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { consented?: boolean };
    expect(body.consented).toBe(true);
  });

  it("POST records consent", async () => {
    setUserGrokConsent.mockResolvedValue(true);

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/grok-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    expect(setUserGrokConsent).toHaveBeenCalledWith("user-1");
  });

  it("returns 401 when unauthenticated", async () => {
    const { unauthorizedError } = await import("@/lib/api/errors");
    requireApiUser.mockResolvedValue({
      error: unauthorizedError("Authentication required"),
    });

    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://127.0.0.1:3000/api/auth/grok-consent"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(401);
  });
});
