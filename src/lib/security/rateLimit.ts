/**
 * Rate limiter — in-memory (dev) nebo Upstash Redis (prod).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const limiterCache = new Map<string, Ratelimit>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  if (store.size > 10_000) cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

function msToDuration(windowMs: number): `${number} s` | `${number} m` | `${number} h` {
  if (windowMs >= 3_600_000) {
    return `${Math.max(1, Math.ceil(windowMs / 3_600_000))} h`;
  }
  if (windowMs >= 60_000) {
    return `${Math.max(1, Math.ceil(windowMs / 60_000))} m`;
  }
  return `${Math.max(1, Math.ceil(windowMs / 1000))} s`;
}

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN &&
      process.env.NODE_ENV === "production"
  );
}

/** Whether Upstash Redis rate limiting is active (production + env vars). */
export function isUpstashRateLimitConfigured(): boolean {
  return isUpstashConfigured();
}

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    const prefix = process.env.RATE_LIMIT_PREFIX?.trim() || "payguard:rl";
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, msToDuration(windowMs)),
      prefix,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

/** Sliding window rate limit (Upstash v prod, paměť jinak) */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (isUpstashConfigured()) {
    try {
      const result = await getUpstashLimiter(limit, windowMs).limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (error) {
      console.error("[rateLimit] Upstash error:", error);
      if (process.env.NODE_ENV === "production") {
        return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs };
      }
    }
  }

  return checkRateLimitMemory(key, limit, windowMs);
}

/** Extrahuje IP z Next.js request headers */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Pro-gated API rate limits — see {@link checkProRateLimit}. */
export {
  checkProRateLimit,
  proRateLimitKey,
  PRO_RATE_LIMITS,
  PRO_RATE_LIMIT_WINDOW_MS,
  type ProRateLimitAction,
} from "@/lib/security/pro-rate-limit";
