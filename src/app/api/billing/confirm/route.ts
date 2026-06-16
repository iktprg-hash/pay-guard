import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { revalidateSubscriptionPages } from "@/lib/billing/revalidate-subscription";
import { syncCheckoutSessionForUser, describeBillingSyncClientError } from "@/lib/billing/sync-checkout";
import { getSubscriptionStatus } from "@/lib/stripe";
import {
  rateLimitError,
  serviceUnavailable,
  validationError,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { billingConfirmSchema } from "@/lib/validation/schemas";

/** Activate Pro from a completed Checkout session (fallback when webhook is delayed). */
export async function POST(request: NextRequest) {
  if (!isStripeBillingConfigured()) {
    return serviceUnavailable("Billing is not configured");
  }

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `billing-confirm:${auth.user.id}:${ip}`,
    20,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const parsed = await parseJsonBody(request, billingConfirmSchema);
    if (!parsed.ok) return validationError(parsed.error);

    const result = await syncCheckoutSessionForUser(
      auth.user.id,
      parsed.data.sessionId
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
    console.error("[api/billing/confirm]", error);
    return NextResponse.json({ error: "Confirm failed" }, { status: 500 });
  }
}
