import { NextRequest } from "next/server";
import { withAuth, type AppRouteContext } from "@/lib/api/protected";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { revalidateSubscriptionPages } from "@/lib/billing/revalidate-subscription";
import { syncCheckoutSessionForUser } from "@/lib/billing/sync-checkout";
import { getSubscriptionStatus } from "@/lib/stripe";
import {
  appErrorFromBillingSyncCode,
  createAppError,
  respondWithError,
  respondWithValidationError,
  toApiResponse,
} from "@/lib/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { billingConfirmSchema } from "@/lib/validation/schemas";

const handleConfirm = withAuth(
  async (request, { user }) => {
    try {
      const parsed = await parseJsonBody(request, billingConfirmSchema);
      if (!parsed.ok) return respondWithValidationError(parsed.error);

      const result = await syncCheckoutSessionForUser(
        user.id,
        parsed.data.sessionId
      );

      if (!result.ok) {
        return toApiResponse(appErrorFromBillingSyncCode(result.code));
      }

      const status = await getSubscriptionStatus(user.id);
      revalidateSubscriptionPages();
      return Response.json({
        pro: true,
        tier: status.tier,
        expiresAt: status.expiresAt,
      });
    } catch (error) {
      console.error("[api/billing/confirm]", error);
      return toApiResponse(
        createAppError("BILLING_CONFIRM_FAILED", { cause: error })
      );
    }
  },
  { rateLimit: { scope: "billing-confirm", limit: 20 } }
);

/** Activate Pro from a completed Checkout session (fallback when webhook is delayed). */
export async function POST(request: NextRequest, context: AppRouteContext) {
  if (!isStripeBillingConfigured()) {
    return respondWithError("BILLING_NOT_CONFIGURED");
  }

  return handleConfirm(request, context);
}
