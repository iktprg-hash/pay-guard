import { NextRequest } from "next/server";
import { withAuth, type AppRouteContext } from "@/lib/api/protected";
import { createCheckoutSession, StripeServiceError } from "@/lib/stripe";
import {
  describeStripeBillingIssue,
  getStripeBillingConfigStatus,
} from "@/lib/billing/config";
import { getUserBillingRecord } from "@/lib/billing/profile-billing";
import { resolveSiteOrigin } from "@/lib/site/url";
import {
  appErrorFromStripeService,
  createAppError,
  respondWithError,
  respondWithValidationError,
  toApiResponse,
} from "@/lib/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { billingLocaleBodySchema } from "@/lib/validation/schemas";

const handleCheckout = withAuth(
  async (request, { user }) => {
    try {
      const parsed = await parseJsonBody(request, billingLocaleBodySchema);
      if (!parsed.ok) return respondWithValidationError(parsed.error);

      const { locale } = parsed.data;
      const origin = resolveSiteOrigin(request);
      const billing = await getUserBillingRecord(user.id);

      const { url } = await createCheckoutSession(user.id, undefined, {
        locale,
        origin,
        email: user.email,
        existingCustomerId: billing?.stripeCustomerId,
      });

      return Response.json({ url });
    } catch (error) {
      if (error instanceof StripeServiceError) {
        return toApiResponse(appErrorFromStripeService(error));
      }

      console.error("[api/billing/checkout]", error);
      return respondWithError("BILLING_CHECKOUT_FAILED", { cause: error });
    }
  },
  { rateLimit: { scope: "billing-checkout", limit: 10 } }
);

/** Create Stripe Checkout Session for Pay Guard Pro (CZK, Czech market). */
export async function POST(request: NextRequest, context: AppRouteContext) {
  const billing = getStripeBillingConfigStatus();
  if (!billing.checkoutEnabled) {
    if (billing.checkoutBlocker) {
      console.error(
        "[api/billing/checkout] Billing misconfigured:",
        describeStripeBillingIssue(billing.checkoutBlocker)
      );
    }
    return respondWithError("BILLING_NOT_CONFIGURED");
  }

  return handleCheckout(request, context);
}
