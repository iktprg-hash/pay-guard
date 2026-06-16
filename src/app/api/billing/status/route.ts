import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getSubscriptionStatus } from "@/lib/stripe";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { parseQueryParams } from "@/lib/api/parse-request";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { emptyQuerySchema } from "@/lib/validation/schemas";

/** Current Stripe subscription status for authenticated client polling. */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const query = parseQueryParams(request, emptyQuerySchema);
  if (!query.ok) return validationError(query.error);

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `billing-status:${auth.user.id}:${ip}`,
    30,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const status = await getSubscriptionStatus(auth.user.id);

  return NextResponse.json({
    tier: status.tier,
    isActive: status.isActive,
    expiresAt: status.expiresAt,
    testMode: status.testMode,
  });
}
