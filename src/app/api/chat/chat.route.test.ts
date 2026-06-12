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
  GrokRequestError: class GrokRequestError extends Error {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue({ user: { id: "user-1" } });
  getUserGrokConsent.mockResolvedValue(true);
  chatWithGrok.mockResolvedValue({
    message: "Hi",
    profileUpdate: null,
    stage: "greeting",
    readyForRecommendation: false,
    analysisMode: "gathering",
    recommendation: null,
  });
});

const validBody = {
  messages: [{ role: "user", content: "Hello" }],
  profile: { availableFunds: 1000, debts: [] },
  locale: "cs",
};

describe("POST /api/chat", () => {
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
  });

  it("passes engine snapshot to Grok when profile is ready", async () => {
    const richBody = {
      messages: [{ role: "user", content: "Mám 8000 a nájem 12000" }],
      profile: {
        availableFunds: 8000,
        debts: [
          {
            id: "1",
            creditor: "Nájem",
            amount: 12_000,
            category: "housing",
            criticalDate: "2026-06-12",
          },
        ],
      },
      locale: "cs",
    };

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(richBody),
      })
    );

    expect(res.status).toBe(200);
    expect(chatWithGrok).toHaveBeenCalled();
    const engineArg = chatWithGrok.mock.calls[0]?.[3]?.engineResult;
    expect(engineArg).toBeDefined();
    expect(engineArg.totalAllocated).toBeGreaterThan(0);

    const body = (await res.json()) as {
      readyForRecommendation?: boolean;
      recommendation?: { totalAllocated: number } | null;
    };
    expect(body.readyForRecommendation).toBe(true);
    expect(body.recommendation?.totalAllocated).toBeGreaterThan(0);
  });
});
