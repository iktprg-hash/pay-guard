import {
  checkRateLimit,
  type RateLimitResult,
} from "@/lib/security/rateLimit";

/** Pro API rate-limit actions (per user + IP, 1-minute window). */
export type ProRateLimitAction =
  | "catalog"
  | "pdf"
  | "sessions-read"
  | "sessions-write"
  | "history-read"
  | "history-write";

export const PRO_RATE_LIMIT_WINDOW_MS = 60_000;

/** Requests per minute per action. */
export const PRO_RATE_LIMITS: Record<ProRateLimitAction, number> = {
  /** Conceptual bucket for catalog-style Pro mutations (30/min). */
  catalog: 30,
  pdf: 10,
  "sessions-read": 30,
  "sessions-write": 30,
  "history-read": 30,
  "history-write": 30,
};

/** Redis / memory key prefix for Pro-gated API routes. */
export function proRateLimitKey(
  action: ProRateLimitAction,
  userId: string,
  ip: string
): string {
  return `pro:${action}:${userId}:${ip}`;
}

export async function checkProRateLimit(
  action: ProRateLimitAction,
  userId: string,
  ip: string
): Promise<RateLimitResult> {
  const limit = PRO_RATE_LIMITS[action];
  return checkRateLimit(
    proRateLimitKey(action, userId, ip),
    limit,
    PRO_RATE_LIMIT_WINDOW_MS
  );
}
