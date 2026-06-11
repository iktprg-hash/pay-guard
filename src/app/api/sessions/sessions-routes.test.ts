import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireProApiUser = vi.fn();
const listUserSessions = vi.fn();
const createUserSession = vi.fn();
const loadUserSessionBundle = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/auth/require-pro", () => ({
  requireProApiUser: () => requireProApiUser(),
}));

vi.mock("@/lib/chat/persistence", () => ({
  listUserSessions: (...args: unknown[]) => listUserSessions(...args),
  createUserSession: (...args: unknown[]) => createUserSession(...args),
  loadUserSessionBundle: (...args: unknown[]) => loadUserSessionBundle(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: () => "127.0.0.1",
}));

const userA = { id: "user-a", email: "a@test.cz" };
const sessionA = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60_000,
  });
  requireProApiUser.mockResolvedValue({ user: userA });
});

describe("GET /api/sessions", () => {
  it("returns 401 when unauthenticated", async () => {
    requireProApiUser.mockResolvedValue({
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    });

    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://127.0.0.1:3000/api/sessions")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not Pro", async () => {
    requireProApiUser.mockResolvedValue({
      error: NextResponse.json(
        { error: "Pro subscription required", code: "pro_required" },
        { status: 403 }
      ),
    });

    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://127.0.0.1:3000/api/sessions")
    );
    expect(res.status).toBe(403);
  });

  it("list response does not expose sessionToken", async () => {
    listUserSessions.mockResolvedValue([
      {
        id: sessionA,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        preview: "Hello",
        messageCount: 1,
        hasRecommendation: false,
        locale: "cs",
      },
    ]);

    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://127.0.0.1:3000/api/sessions")
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessions: Array<Record<string, unknown>>;
    };
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]).not.toHaveProperty("sessionToken");
  });
});

describe("POST /api/sessions", () => {
  it("returns sessionToken only on create", async () => {
    createUserSession.mockResolvedValue({
      sessionId: sessionA,
      sessionToken: "b".repeat(32),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "cs" }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessionId: string;
      sessionToken: string;
    };
    expect(body.sessionId).toBe(sessionA);
    expect(body.sessionToken).toHaveLength(32);
  });
});

describe("GET /api/sessions/[sessionId]", () => {
  it("returns 404 when user cannot access session (IDOR)", async () => {
    loadUserSessionBundle.mockResolvedValue(null);

    const { GET } = await import("./[sessionId]/route");
    const res = await GET(
      new NextRequest(`http://127.0.0.1:3000/api/sessions/${sessionA}`),
      { params: Promise.resolve({ sessionId: sessionA }) }
    );

    expect(res.status).toBe(404);
  });

  it("detail response does not expose sessionToken", async () => {
    loadUserSessionBundle.mockResolvedValue({
      sessionId: sessionA,
      messages: [],
      profile: { availableFunds: 0, debts: [] },
      locale: "cs",
      updatedAt: "2026-06-01T00:00:00.000Z",
      preview: "Test",
    });

    const { GET } = await import("./[sessionId]/route");
    const res = await GET(
      new NextRequest(`http://127.0.0.1:3000/api/sessions/${sessionA}`),
      { params: Promise.resolve({ sessionId: sessionA }) }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.sessionId).toBe(sessionA);
    expect(body).not.toHaveProperty("sessionToken");
  });

  it("returns 400 for invalid sessionId UUID", async () => {
    const { GET } = await import("./[sessionId]/route");
    const res = await GET(
      new NextRequest("http://127.0.0.1:3000/api/sessions/not-a-valid-uuid"),
      { params: Promise.resolve({ sessionId: "not-a-valid-uuid" }) }
    );

    expect(res.status).toBe(400);
    expect(loadUserSessionBundle).not.toHaveBeenCalled();
  });
});
