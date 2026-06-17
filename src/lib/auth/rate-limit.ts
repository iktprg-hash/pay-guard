import type { NextRequest } from "next/server";
import { rateLimitError } from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

type RateLimitRule = { limit: number; windowMs: number };

const isDev = process.env.NODE_ENV === "development";
const skipRateLimit =
  isDev && process.env.AUTH_SKIP_RATE_LIMIT === "1";
const skipRateLimitForE2E = process.env.E2E_DISABLE_AUTH_RATE_LIMIT === "1";

async function checkKeys(keys: string[], rule: RateLimitRule) {
  for (const key of keys) {
    const result = await checkRateLimit(key, rule.limit, rule.windowMs);
    if (!result.allowed) return result;
  }
  return null;
}

/** Rate limit pro veřejné auth endpointy (IP + volitelně e-mail) */
export async function enforceAuthRateLimit(
  request: NextRequest,
  action: string,
  email?: string,
  options?: { skipIp?: boolean }
) {
  if (skipRateLimit || skipRateLimitForE2E) return null;

  const ip = getClientIp(request.headers);
  const ipKeys = [`${action}:ip:${ip}`];
  const emailKeys = email
    ? [`${action}:email:${email.toLowerCase()}`]
    : [];

  const rules: Record<string, RateLimitRule[]> = {
    login: [
      { limit: 20, windowMs: 15 * 60_000 },
      { limit: 10, windowMs: 15 * 60_000 },
    ],
    register: [
      { limit: 15, windowMs: 60 * 60_000 },
      { limit: 8, windowMs: 60 * 60_000 },
    ],
    "send-otp": [
      { limit: 20, windowMs: 60 * 60_000 },
      { limit: 8, windowMs: 60 * 60_000 },
    ],
    "verify-otp": [
      { limit: 30, windowMs: 15 * 60_000 },
      { limit: 10, windowMs: 15 * 60_000 },
    ],
    confirm: [{ limit: 15, windowMs: 15 * 60_000 }],
    "forgot-password": [
      { limit: 10, windowMs: 60 * 60_000 },
      { limit: 5, windowMs: 60 * 60_000 },
    ],
    "reset-password": [{ limit: 15, windowMs: 15 * 60_000 }],
    logout: [{ limit: 30, windowMs: 60 * 60_000 }],
    "session-claim": [
      { limit: 20, windowMs: 15 * 60_000 },
      { limit: 10, windowMs: 15 * 60_000 },
    ],
  };

  const [ipRule, emailRule] = rules[action] ?? [
    { limit: 20, windowMs: 15 * 60_000 },
  ];

  if (!options?.skipIp) {
    const ipBlocked = await checkKeys(ipKeys, ipRule);
    if (ipBlocked) return rateLimitError(ipBlocked.resetAt);
  }

  if (email && emailRule) {
    const emailBlocked = await checkKeys(emailKeys, emailRule);
    if (emailBlocked) return rateLimitError(emailBlocked.resetAt);
  }

  return null;
}

/** Je chyba z Supabase e-mail rate limitu (ne z naší aplikace) */
export function isSupabaseEmailRateLimit(message?: string): boolean {
  if (!message) return false;
  return message.toLowerCase().includes("email rate limit");
}
