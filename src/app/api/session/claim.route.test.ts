import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireApiUser = vi.fn();
const claimSessionForUser = vi.fn();
const enforceAuthRateLimit = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: () => requireApiUser(),
}));

vi.mock("@/lib/chat/persistence", () => ({
  claimSessionForUser: (...args: unknown[]) => claimSessionForUser(...args),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  enforceAuthRateLimit: (...args: unknown[]) => enforceAuthRateLimit(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const sessionToken = "c".repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  enforceAuthRateLimit.mockResolvedValue(null);
  requireApiUser.mockResolvedValue({ user: { id: "user-a" } });
});

describe("POST /api/session/claim", () => {
  it("returns 401 when unauthenticated", async () => {
    requireApiUser.mockResolvedValue({
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    });

    const { POST } = await import("./claim/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/session/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sessionToken }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 409 when hijacking owned session", async () => {
    claimSessionForUser.mockResolvedValue(false);

    const { POST } = await import("./claim/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/session/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sessionToken }),
      })
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it("returns ok on successful claim", async () => {
    claimSessionForUser.mockResolvedValue(true);

    const { POST } = await import("./claim/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/session/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sessionToken }),
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 400 for invalid sessionId", async () => {
    const { POST } = await import("./claim/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/session/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "bad", sessionToken }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    enforceAuthRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );

    const { POST } = await import("./claim/route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/session/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sessionToken }),
      })
    );
    expect(res.status).toBe(429);
  });
});
