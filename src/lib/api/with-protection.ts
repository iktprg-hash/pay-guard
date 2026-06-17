import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getClientIp } from "@/lib/security/rateLimit";
import { checkProRateLimit } from "@/lib/security/pro-rate-limit";
import { checkAuthenticatedRateLimit } from "@/lib/security/authenticated-rate-limit";
import { handleApiError, respondWithError } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth/session";
import { userHasProAccess } from "@/lib/auth/subscription";

export type ProtectionOptions = {
  requirePro?: boolean;
  rateLimit?: {
    scope: string;
    limit: number;
  };
};

export function withProtection(
  handler: (
    req: NextRequest,
    context: { user: User }
  ) => Promise<NextResponse> | NextResponse,
  options: ProtectionOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const auth = await requireApiUser();
      if ("error" in auth) {
        return auth.error as NextResponse;
      }

      const user = auth.user;

      if (options.requirePro) {
        const pro = await userHasProAccess(user.id);
        if (!pro) {
          return respondWithError("PRO_REQUIRED");
        }
      }

      // === Rate Limiting ===
      if (options.rateLimit) {
        const { scope, limit } = options.rateLimit;
        const ip = getClientIp(req.headers);

        let rateLimitResult;

        if (options.requirePro) {
          rateLimitResult = await checkProRateLimit(
            scope as import("@/lib/security/pro-rate-limit").ProRateLimitAction,
            user.id,
            ip
          );
        } else {
          rateLimitResult = await checkAuthenticatedRateLimit(
            scope,
            user.id,
            ip,
            limit
          );
        }

        if (!rateLimitResult.allowed) {
          return respondWithError("RATE_LIMITED");
        }
      }

      return await handler(req, { user });
    } catch (error) {
      return handleApiError(error);
    }
  };
}
