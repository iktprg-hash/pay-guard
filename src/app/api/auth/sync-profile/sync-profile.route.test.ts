import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireApiUser = vi.fn();
const syncUserProfileLocale = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: () => requireApiUser(),
}));

vi.mock("@/lib/auth/profile", () => ({
  syncUserProfileLocale: (...args: unknown[]) => syncUserProfileLocale(...args),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 1, resetAt: 0 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue({ user: { id: "user-1" } });
});

describe("POST /api/auth/sync-profile", () => {
  it("returns 401 when unauthenticated", async () => {
    requireApiUser.mockResolvedValue({
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "ru" }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      })
    );

    expect(res.status).toBe(400);
    expect(syncUserProfileLocale).not.toHaveBeenCalled();
  });

  it("syncs locale for authenticated user", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "ru" }),
      })
    );

    expect(res.status).toBe(200);
    expect(syncUserProfileLocale).toHaveBeenCalledWith("user-1", "ru");
  });
});
