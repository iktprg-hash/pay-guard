import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { withProtection } from "@/lib/api/with-protection";

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("@/lib/auth/subscription", () => ({
  userHasProAccess: vi.fn(),
}));

vi.mock("@/lib/security/pro-rate-limit", () => ({
  PRO_RATE_LIMITS: { pdf: 10 },
  checkProRateLimit: vi.fn(),
}));

vi.mock("@/lib/security/authenticated-rate-limit", () => ({
  checkAuthenticatedRateLimit: vi.fn(),
}));

describe("withProtection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    const { requireApiUser } = await import("@/lib/auth/session");
    vi.mocked(requireApiUser).mockResolvedValue({
      error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    });

    const POST = withProtection(async () => NextResponse.json({ ok: true }));
    const res = await POST(
      new NextRequest("http://localhost/api/test", { method: "POST" })
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when Pro is required but missing", async () => {
    const { requireApiUser } = await import("@/lib/auth/session");
    const { userHasProAccess } = await import("@/lib/auth/subscription");

    vi.mocked(requireApiUser).mockResolvedValue({
      user: { id: "user-1" } as never,
    });
    vi.mocked(userHasProAccess).mockResolvedValue(false);

    const POST = withProtection(async () => NextResponse.json({ ok: true }), {
      requirePro: true,
    });
    const res = await POST(
      new NextRequest("http://localhost/api/test", { method: "POST" })
    );

    expect(res.status).toBe(403);
  });

  it("invokes handler with authenticated Pro user and rate limit", async () => {
    const { requireApiUser } = await import("@/lib/auth/session");
    const { userHasProAccess } = await import("@/lib/auth/subscription");
    const { checkProRateLimit } = await import("@/lib/security/pro-rate-limit");

    vi.mocked(requireApiUser).mockResolvedValue({
      user: { id: "pro-1" } as never,
    });
    vi.mocked(userHasProAccess).mockResolvedValue(true);
    vi.mocked(checkProRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });

    const handler = vi.fn(async (_request, { user }) =>
      NextResponse.json({ userId: user.id })
    );

    const POST = withProtection(handler, {
      requirePro: true,
      rateLimit: { scope: "pdf", limit: 10 },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/pdf/recommendation", {
        method: "POST",
      })
    );
    const body = (await res.json()) as { userId: string };

    expect(res.status).toBe(200);
    expect(body.userId).toBe("pro-1");
    expect(checkProRateLimit).toHaveBeenCalledWith(
      "pdf",
      "pro-1",
      expect.any(String)
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it("maps unexpected handler errors through handleApiError", async () => {
    const { requireApiUser } = await import("@/lib/auth/session");
    vi.mocked(requireApiUser).mockResolvedValue({
      user: { id: "user-1" } as never,
    });

    const POST = withProtection(async () => {
      throw new Error("boom");
    });

    const res = await POST(
      new NextRequest("http://localhost/api/test", { method: "POST" })
    );

    expect(res.status).toBe(500);
  });
});
