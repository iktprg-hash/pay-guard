import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AppRouteContext } from "@/lib/api/protected";
import {
  createCheckoutSession,
  StripeServiceError,
} from "@/lib/stripe";
import {
  describeStripeBillingIssue,
  getStripeBillingConfigStatus,
} from "@/lib/billing/config";
import { getUserBillingRecord } from "@/lib/billing/profile-billing";
import { resolveSiteOrigin } from "@/lib/site/url";
import {
  serviceUnavailable,
  validationError,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { billingLocaleBodySchema } from "@/lib/validation/schemas";

const handleCheckout = withAuth(
  async (request, { user }) => {
    try {
      const parsed = await parseJsonBody(request, billingLocaleBodySchema);
      if (!parsed.ok) return validationError(parsed.error);

      const { locale } = parsed.data;
      const origin = resolveSiteOrigin(request);
      const billing = await getUserBillingRecord(user.id);

      const { url } = await createCheckoutSession(user.id, undefined, {
        locale,
        origin,
        email: user.email,
        existingCustomerId: billing?.stripeCustomerId,
      });

      return NextResponse.json({ url });
    } catch (error) {
      if (error instanceof StripeServiceError) {
        if (error.code === "not_configured") {
          return serviceUnavailable("Billing is not configured");
        }
        if (error.code === "already_pro") {
          return NextResponse.json(
            {
              error: "You already have an active Pro subscription.",
              code: "already_pro",
            },
            { status: 409 }
          );
        }
        if (error.code === "email_required") {
          return NextResponse.json(
            {
              error: "An email address is required to start a subscription.",
              code: "email_required",
            },
            { status: 422 }
          );
        }
      }

      console.error("[api/billing/checkout]", error);
      return NextResponse.json(
        { error: "Checkout failed", code: "stripe_error" },
        { status: 500 }
      );
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
    return NextResponse.json(
      { error: "Billing is not configured", code: "billing_not_configured" },
      { status: 503 }
    );
  }

  return handleCheckout(request, context);
}
