import { NextRequest } from "next/server";
import { withAuth, type AppRouteContext } from "@/lib/api/protected";
import {
  createCustomerPortalSession,
  StripeServiceError,
} from "@/lib/stripe";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { resolveSiteOrigin } from "@/lib/site/url";
import { validationError } from "@/lib/api/errors";
import {
  appErrorFromStripeService,
  createAppError,
  respondWithError,
  toApiResponse,
} from "@/lib/errors";
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

      return Response.json({ url });
    } catch (error) {
      if (error instanceof StripeServiceError) {
        return toApiResponse(appErrorFromStripeService(error));
      }

      console.error("[api/billing/portal]", error);
      return toApiResponse(
        createAppError("STRIPE_ERROR", {
          message: "Portal failed",
          cause: error,
        })
      );
    }
  },
  { rateLimit: { scope: "billing-portal", limit: 15 } }
);

/** Stripe Customer Portal — manage / cancel subscription. */
export async function POST(request: NextRequest, context: AppRouteContext) {
  if (!isStripeBillingConfigured()) {
    return respondWithError("BILLING_NOT_CONFIGURED");
  }

  return handlePortal(request, context);
}
