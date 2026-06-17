import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AppRouteContext } from "@/lib/api/protected";
import {
  createCustomerPortalSession,
  StripeServiceError,
} from "@/lib/stripe";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { resolveSiteOrigin } from "@/lib/site/url";
import {
  serviceUnavailable,
  validationError,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { billingLocaleBodySchema } from "@/lib/validation/schemas";

const handlePortal = withAuth(
  async (request, { user }) => {
    try {
      const parsed = await parseJsonBody(request, billingLocaleBodySchema);
      if (!parsed.ok) return validationError(parsed.error);

      const { locale } = parsed.data;
      const origin = resolveSiteOrigin(request);

      const { url } = await createCustomerPortalSession(user.id, {
        returnUrl: `${origin}/${locale}/settings`,
      });

      return NextResponse.json({ url });
    } catch (error) {
      if (error instanceof StripeServiceError) {
        if (error.code === "no_customer") {
          return NextResponse.json(
            {
              error: "No billing account found. Please complete a purchase first.",
              code: "no_customer",
            },
            { status: 404 }
          );
        }
      }

      console.error("[api/billing/portal]", error);
      return NextResponse.json({ error: "Portal failed" }, { status: 500 });
    }
  },
  { rateLimit: { scope: "billing-portal", limit: 15 } }
);

/** Stripe Customer Portal — manage / cancel subscription. */
export async function POST(request: NextRequest, context: AppRouteContext) {
  if (!isStripeBillingConfigured()) {
    return serviceUnavailable("Billing is not configured");
  }

  return handlePortal(request, context);
}
