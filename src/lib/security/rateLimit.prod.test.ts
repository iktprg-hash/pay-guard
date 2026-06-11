import { describe, expect, it, vi, afterEach } from "vitest";

describe("checkRateLimit production fail-closed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("blocks when Upstash fails in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        static slidingWindow() {
          return {};
        }
        limit() {
          return Promise.reject(new Error("Redis down"));
        }
      },
    }));

    vi.doMock("@upstash/redis", () => ({
      Redis: {
        fromEnv: () => ({}),
      },
    }));

    const { checkRateLimit } = await import("@/lib/security/rateLimit");
    const result = await checkRateLimit("prod-fail-key", 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
