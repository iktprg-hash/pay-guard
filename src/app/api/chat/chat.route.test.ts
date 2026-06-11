import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireApiUser = vi.fn();
const chatWithGrok = vi.fn();
const getUserGrokConsent = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: () => requireApiUser(),
}));

vi.mock("@/lib/auth/grok-consent", () => ({
  getUserGrokConsent: (...args: unknown[]) => getUserGrokConsent(...args),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 1, resetAt: 0 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/grok/client", () => ({
  chatWithGrok: (...args: unknown[]) => chatWithGrok(...args),
  GrokUnavailableError: class GrokUnavailableError extends Error {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue({ user: { id: "user-1" } });
  getUserGrokConsent.mockResolvedValue(true);
  chatWithGrok.mockResolvedValue({
    message: "Hi",
    profileUpdate: null,
    stage: "greeting",
  });
});

const validBody = {
  messages: [{ role: "user", content: "Hello" }],
  profile: { availableFunds: 1000, debts: [] },
  locale: "cs",
};

describe("POST /api/chat server-side grok consent", () => {
  it("returns 401 when server-side Grok consent is missing", async () => {
    getUserGrokConsent.mockResolvedValue(false);

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    );

    expect(res.status).toBe(401);
    expect(chatWithGrok).not.toHaveBeenCalled();
    expect(getUserGrokConsent).toHaveBeenCalledWith("user-1");
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      })
    );

    expect(res.status).toBe(400);
    expect(chatWithGrok).not.toHaveBeenCalled();
  });

  it("accepts chat when server-side consent is granted", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    );

    expect(res.status).toBe(200);
    expect(chatWithGrok).toHaveBeenCalled();
  });
});
