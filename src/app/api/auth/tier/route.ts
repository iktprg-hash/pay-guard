import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  getUserSubscription,
  isActivePro,
} from "@/lib/auth/subscription";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { parseQueryParams } from "@/lib/api/parse-request";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { emptyQuerySchema } from "@/lib/validation/schemas";

/** Aktuální subscription tier přihlášeného uživatele */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const query = parseQueryParams(request, emptyQuerySchema);
  if (!query.ok) return validationError(query.error);

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `auth-tier:${auth.user.id}:${ip}`,
    60,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const subscription = await getUserSubscription(auth.user.id);

  return NextResponse.json({
    tier: subscription.tier,
    pro: isActivePro(subscription),
    isProEnabled: isActivePro(subscription),
    expiresAt: subscription.expiresAt,
  });
}
