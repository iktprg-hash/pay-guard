import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  applyRouteRateLimit,
  runRouteProtection,
  withAuth,
  withProProtection,
} from "@/lib/api/protected";

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("@/lib/auth/require-pro", () => ({
  requireProApiUser: vi.fn(),
}));

vi.mock("@/lib/security/pro-rate-limit", () => ({
  PRO_RATE_LIMITS: { pdf: 10 },
  checkProRateLimit: vi.fn(),
}));

vi.mock("@/lib/security/authenticated-rate-limit", () => ({
  AUTHENTICATED_RATE_LIMITS: {
    chat: { limit: 20, windowMs: 60_000 },
  },
  checkAuthenticatedRateLimit: vi.fn(),
}));

describe("runRouteProtection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    const { requireApiUser } = await import("@/lib/auth/session");
    vi.mocked(requireApiUser).mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    });

    const headers = new Headers();
    const result = await runRouteProtection(headers);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns user when auth succeeds", async () => {
    const { requireApiUser } = await import("@/lib/auth/session");
    vi.mocked(requireApiUser).mockResolvedValue({
      user: { id: "user-1" } as never,
    });

    const result = await runRouteProtection(new Headers());

    expect(result).toEqual({ ok: true, user: { id: "user-1" } });
  });

  it("delegates to requireProApiUser when requirePro is true", async () => {
    const { requireProApiUser } = await import("@/lib/auth/require-pro");
    vi.mocked(requireProApiUser).mockResolvedValue({
      user: { id: "pro-user" } as never,
    });

    const result = await runRouteProtection(new Headers(), { requirePro: true });

    expect(requireProApiUser).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, user: { id: "pro-user" } });
  });
});

describe("withProProtection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes handler with authenticated Pro user", async () => {
    const { requireProApiUser } = await import("@/lib/auth/require-pro");
    const { checkProRateLimit } = await import("@/lib/security/pro-rate-limit");

    vi.mocked(requireProApiUser).mockResolvedValue({
      user: { id: "pro-1" } as never,
    });
    vi.mocked(checkProRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });

    const handler = vi.fn(async (_request, { user }) =>
      Response.json({ userId: user.id })
    );

    const POST = withProProtection(handler, { rateLimit: "pdf" });
    const request = new NextRequest("http://localhost/api/pdf/recommendation", {
      method: "POST",
    });

    const response = await POST(request, undefined as never);
    const body = (await response.json()) as { userId: string };

    expect(response.status).toBe(200);
    expect(body.userId).toBe("pro-1");
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("withAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies authenticated rate limit preset", async () => {
    const { requireApiUser } = await import("@/lib/auth/session");
    const { checkAuthenticatedRateLimit } = await import(
      "@/lib/security/authenticated-rate-limit"
    );

    vi.mocked(requireApiUser).mockResolvedValue({
      user: { id: "user-1" } as never,
    });
    vi.mocked(checkAuthenticatedRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: Date.now() + 60_000,
    });

    await applyRouteRateLimit(new Headers(), "user-1", "chat");

    expect(checkAuthenticatedRateLimit).toHaveBeenCalledWith(
      "chat",
      "user-1",
      expect.any(String),
      20,
      60_000
    );
  });
});
