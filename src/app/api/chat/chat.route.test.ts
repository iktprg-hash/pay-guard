import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireApiUser = vi.fn();
const chatWithGrok = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: () => requireApiUser(),
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
  chatWithGrok.mockResolvedValue({
    message: "Hi",
    profileUpdate: null,
    stage: "greeting",
  });
});

describe("POST /api/chat grok consent", () => {
  it("requires grokConsent: true in body", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello" }],
          profile: { availableFunds: 1000, debts: [] },
          locale: "cs",
        }),
      })
    );

    expect(res.status).toBe(400);
    expect(chatWithGrok).not.toHaveBeenCalled();
  });

  it("accepts chat when grokConsent is true", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello" }],
          profile: { availableFunds: 1000, debts: [] },
          locale: "cs",
          grokConsent: true,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(chatWithGrok).toHaveBeenCalled();
  });
});
