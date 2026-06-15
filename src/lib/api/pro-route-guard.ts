import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { rateLimitError } from "@/lib/api/errors";
import { requireProApiUser } from "@/lib/auth/require-pro";
import {
  checkProRateLimit,
  type ProRateLimitAction,
} from "@/lib/security/pro-rate-limit";
import { getClientIp } from "@/lib/security/rateLimit";

export type ProRouteGuardResult =
  | { ok: true; user: User }
  | { ok: false; response: Response };

/** Require Pro subscription + apply Pro rate limit for API routes. */
export async function requireProApiWithRateLimit(
  request: NextRequest,
  action: ProRateLimitAction
): Promise<ProRouteGuardResult> {
  const auth = await requireProApiUser();
  if ("error" in auth) {
    return { ok: false, response: auth.error };
  }

  const ip = getClientIp(request.headers);
  const limit = await checkProRateLimit(action, auth.user.id, ip);
  if (!limit.allowed) {
    return { ok: false, response: rateLimitError(limit.resetAt) };
  }

  return { ok: true, user: auth.user };
}
