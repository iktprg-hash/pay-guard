import { describe, expect, it, vi, afterEach } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

describe("getClientIp", () => {
  it("prefers x-vercel-forwarded-for over client-spoofable headers", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.1",
      "x-forwarded-for": "198.51.100.99",
      "x-real-ip": "198.51.100.99",
    });
    expect(getClientIp(headers)).toBe("203.0.113.1");
  });

  it("falls back to x-forwarded-for for local dev", () => {
    const headers = new Headers({ "x-forwarded-for": "127.0.0.1, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("127.0.0.1");
  });

  it("returns unknown when no ip headers are present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("checkRateLimit (memory fallback)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("warns when using memory fallback outside development", async () => {
    process.env.NODE_ENV = "test";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const key = `test-warn-${Date.now()}`;

    await checkRateLimit(key, 3, 60_000);

    expect(warnSpy).toHaveBeenCalledWith(
      "[rateLimit] Using in-memory rate limiter outside development. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for effective rate limiting."
    );
  });

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
