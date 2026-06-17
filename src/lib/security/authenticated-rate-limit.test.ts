import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkAuthenticatedRateLimit } from "@/lib/security/authenticated-rate-limit";
import { checkRateLimit } from "@/lib/security/rateLimit";

vi.mock("@/lib/security/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/rateLimit")>();
  return {
    ...actual,
    checkRateLimit: vi.fn(),
  };
});

describe("checkAuthenticatedRateLimit", () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockReset();
  });

  it("denies when userId-only ceiling is exceeded before IP check", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const result = await checkAuthenticatedRateLimit(
      "chat",
      "user-1",
      "1.2.3.4",
      20,
      60_000
    );

    expect(result.allowed).toBe(false);
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(checkRateLimit).toHaveBeenCalledWith("chat:user-1", 60, 60_000);
  });

  it("checks userId+IP limit after userId ceiling passes", async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 59,
        resetAt: Date.now() + 60_000,
      })
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 19,
        resetAt: Date.now() + 60_000,
      });

    const result = await checkAuthenticatedRateLimit(
      "prioritize",
      "user-1",
      "9.9.9.9",
      60,
      60_000
    );

    expect(result.allowed).toBe(true);
    expect(checkRateLimit).toHaveBeenNthCalledWith(
      2,
      "prioritize:user-1:9.9.9.9",
      60,
      60_000
    );
  });
});
