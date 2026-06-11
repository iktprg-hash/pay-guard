import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { chatWithGrok, GrokRequestError } from "@/lib/grok/client";

describe("chatWithGrok errors", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    process.env.XAI_API_KEY = "xai-test-key";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.XAI_API_KEY;
  });

  it("throws GrokRequestError without leaking xAI response body", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "secret upstream error details",
    });

    await expect(
      chatWithGrok([], { availableFunds: 0, debts: [] }, "cs")
    ).rejects.toBeInstanceOf(GrokRequestError);

    await expect(
      chatWithGrok([], { availableFunds: 0, debts: [] }, "cs")
    ).rejects.not.toThrow(/secret upstream/);
  });
});
