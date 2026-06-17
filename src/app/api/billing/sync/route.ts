import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { syncActiveSubscriptionByEmail, describeBillingSyncClientError } from "@/lib/billing/sync-checkout";
import { revalidateSubscriptionPages } from "@/lib/billing/revalidate-subscription";
import { getSubscriptionStatus } from "@/lib/stripe";
import {
  rateLimitError,
  serviceUnavailable,
} from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

/** Recover Pro from Stripe by account email (e.g. webhook missed). */
export async function POST(request: NextRequest) {
  if (!isStripeBillingConfigured()) {
    return serviceUnavailable("Billing is not configured");
  }

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  if (!auth.user.email) {
    return NextResponse.json(
      { error: "Account email required", code: "email_required" },
      { status: 422 }
    );
  }

  const userLimit = await checkRateLimit(
    `billing-sync:${auth.user.id}`,
    30,
    60_000
  );
  if (!userLimit.allowed) return rateLimitError(userLimit.resetAt);

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `billing-sync:${auth.user.id}:${ip}`,
    10,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const result = await syncActiveSubscriptionByEmail(
      auth.user.id,
      auth.user.email
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error: describeBillingSyncClientError(result.code),
          code: result.code,
        },
        { status: 422 }
      );
    }

    const status = await getSubscriptionStatus(auth.user.id);
    revalidateSubscriptionPages();
    return NextResponse.json({
      pro: true,
      tier: status.tier,
      expiresAt: status.expiresAt,
    });
  } catch (error) {
    console.error("[api/billing/sync]", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
