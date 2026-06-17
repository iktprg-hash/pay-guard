import {
  checkRateLimit,
  type RateLimitResult,
} from "@/lib/security/rateLimit";

/** Per-minute limits for authenticated non-Pro API routes. */
export const AUTHENTICATED_RATE_LIMITS = {
  chat: { limit: 20, windowMs: 60_000 },
  prioritize: { limit: 60, windowMs: 60_000 },
} as const;

/**
 * Authenticated API rate limit — userId ceiling first (IP-independent), then userId+IP.
 * Prevents shared-IP bypass while keeping per-user fairness.
 */
export async function checkAuthenticatedRateLimit(
  scope: string,
  userId: string,
  ip: string,
  limit: number,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const userResult = await checkRateLimit(
    `${scope}:${userId}`,
    limit * 3,
    windowMs
  );
  if (!userResult.allowed) return userResult;

  return checkRateLimit(`${scope}:${userId}:${ip}`, limit, windowMs);
}
