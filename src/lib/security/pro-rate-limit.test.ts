import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { checkProRateLimit } from "@/lib/security/pro-rate-limit";
import { checkRateLimit } from "@/lib/security/rateLimit";

vi.mock("@/lib/security/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/rateLimit")>();
  return {
    ...actual,
    checkRateLimit: vi.fn(),
  };
});

describe("checkProRateLimit", () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockReset();
  });

  it("denies when userId-only ceiling is exceeded before IP check", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const result = await checkProRateLimit("sessions-read", "user-1", "1.2.3.4");

    expect(result.allowed).toBe(false);
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(checkRateLimit).toHaveBeenCalledWith(
      "pro:sessions-read:user-1",
      90,
      60_000
    );
  });

  it("checks userId+IP limit after userId ceiling passes", async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 89,
        resetAt: Date.now() + 60_000,
      })
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 29,
        resetAt: Date.now() + 60_000,
      });

    const result = await checkProRateLimit("sessions-read", "user-1", "1.2.3.4");

    expect(result.allowed).toBe(true);
    expect(checkRateLimit).toHaveBeenCalledTimes(2);
    expect(checkRateLimit).toHaveBeenNthCalledWith(
      2,
      "pro:sessions-read:user-1:1.2.3.4",
      30,
      60_000
    );
  });
});
