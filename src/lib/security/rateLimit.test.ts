import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/security/rateLimit";

describe("checkRateLimit (memory fallback)", () => {
  it("allows requests under the limit", async () => {
    const key = `test-allow-${Date.now()}`;
    const first = await checkRateLimit(key, 3, 60_000);
    const second = await checkRateLimit(key, 3, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks requests over the limit", async () => {
    const key = `test-block-${Date.now()}`;

    await checkRateLimit(key, 2, 60_000);
    await checkRateLimit(key, 2, 60_000);
    const third = await checkRateLimit(key, 2, 60_000);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });
});
