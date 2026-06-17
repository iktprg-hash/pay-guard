import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  runRouteProtectionForRequest,
  type ProtectionResult,
} from "@/lib/api/protected";
import type { ProRateLimitAction } from "@/lib/security/pro-rate-limit";

export type ProRouteGuardResult = ProtectionResult;

/** Require Pro subscription + apply Pro rate limit for API routes. */
export async function requireProApiWithRateLimit(
  request: NextRequest,
  action: ProRateLimitAction
): Promise<ProRouteGuardResult> {
  return runRouteProtectionForRequest(request, {
    requirePro: true,
    rateLimit: action,
  });
}

export type { User };
