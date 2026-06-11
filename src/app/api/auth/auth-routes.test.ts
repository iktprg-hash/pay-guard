import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const enforceAuthRateLimit = vi.fn();
const createSessionRouteClient = vi.fn();
const signInWithPassword = vi.fn();
const updateUser = vi.fn();
const getUser = vi.fn();
const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/auth/rate-limit", () => ({
  enforceAuthRateLimit: (...args: unknown[]) => enforceAuthRateLimit(...args),
}));

vi.mock("@/lib/auth/supabase-route", () => ({
  createSessionRouteClient: (...args: unknown[]) =>
    createSessionRouteClient(...args),
}));

vi.mock("@/lib/auth/dev-register", () => ({
  canUseDevRegisterBypass: () => false,
  devRegisterWithPassword: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail },
  }),
}));

function post(path: string, body: unknown) {
  return new NextRequest(`http://127.0.0.1:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enforceAuthRateLimit.mockResolvedValue(null);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

  createSessionRouteClient.mockReturnValue({
    auth: {
      signInWithPassword,
      signUp: vi.fn(),
      updateUser,
      getUser,
    },
  });
});

describe("POST /api/auth/login", () => {
  it("returns 401 for invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const { POST } = await import("./login/route");
    const res = await POST(
      post("/api/auth/login", { email: "a@b.cz", password: "secret" })
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("invalid_credentials");
  });

  it("returns 400 for invalid email", async () => {
    const { POST } = await import("./login/route");
    const res = await POST(
      post("/api/auth/login", { email: "not-email", password: "x" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    enforceAuthRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );

    const { POST } = await import("./login/route");
    const res = await POST(
      post("/api/auth/login", { email: "a@b.cz", password: "secret" })
    );
    expect(res.status).toBe(429);
  });

  it("returns ok on successful login", async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    const { POST } = await import("./login/route");
    const res = await POST(
      post("/api/auth/login", { email: "a@b.cz", password: "Heslo123" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /api/auth/register", () => {
  it("returns 400 for weak password", async () => {
    const { POST } = await import("./register/route");
    const res = await POST(
      post("/api/auth/register", {
        email: "new@b.cz",
        password: "NoDigitsHere",
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("password_requirements");
  });

  it("returns 400 for password without digit", async () => {
    const { POST } = await import("./register/route");
    const res = await POST(
      post("/api/auth/register", {
        email: "new@b.cz",
        password: "NoDigitsHere",
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns ok when reset email is sent", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });

    const { POST } = await import("./forgot-password/route");
    const res = await POST(
      post("/api/auth/forgot-password", {
        email: "user@b.cz",
        locale: "cs",
      })
    );

    expect(res.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "user@b.cz",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/auth/confirm"),
      })
    );
  });

  it("returns 400 for invalid email", async () => {
    const { POST } = await import("./forgot-password/route");
    const res = await POST(
      post("/api/auth/forgot-password", { email: "bad", locale: "cs" })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("returns 401 without recovery session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { POST } = await import("./reset-password/route");
    const res = await POST(
      post("/api/auth/reset-password", { password: "Heslo123" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for weak new password", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const { POST } = await import("./reset-password/route");
    const res = await POST(
      post("/api/auth/reset-password", { password: "weak" })
    );
    expect(res.status).toBe(400);
  });

  it("updates password when session is valid", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    updateUser.mockResolvedValue({ error: null });

    const { POST } = await import("./reset-password/route");
    const res = await POST(
      post("/api/auth/reset-password", { password: "Heslo123" })
    );
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password: "Heslo123" });
  });
});
