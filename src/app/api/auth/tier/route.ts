import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  getUserSubscription,
  isActivePro,
} from "@/lib/auth/subscription";
import { rateLimitError } from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

/** Aktuální subscription tier přihlášeného uživatele */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

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
    expiresAt: subscription.expiresAt,
  });
}
