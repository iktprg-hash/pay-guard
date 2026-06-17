import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AppRouteContext } from "@/lib/api/protected";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { revalidateSubscriptionPages } from "@/lib/billing/revalidate-subscription";
import { syncCheckoutSessionForUser, describeBillingSyncClientError } from "@/lib/billing/sync-checkout";
import { getSubscriptionStatus } from "@/lib/stripe";
import { serviceUnavailable, validationError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { billingConfirmSchema } from "@/lib/validation/schemas";

const handleConfirm = withAuth(
  async (request, { user }) => {
    try {
      const parsed = await parseJsonBody(request, billingConfirmSchema);
      if (!parsed.ok) return validationError(parsed.error);

      const result = await syncCheckoutSessionForUser(
        user.id,
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

      const status = await getSubscriptionStatus(user.id);
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
  },
  { rateLimit: { scope: "billing-confirm", limit: 20 } }
);

/** Activate Pro from a completed Checkout session (fallback when webhook is delayed). */
export async function POST(request: NextRequest, context: AppRouteContext) {
  if (!isStripeBillingConfigured()) {
    return serviceUnavailable("Billing is not configured");
  }

  return handleConfirm(request, context);
}
