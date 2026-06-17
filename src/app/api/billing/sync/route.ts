import { NextRequest } from "next/server";
import { withAuth, type AppRouteContext } from "@/lib/api/protected";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { syncActiveSubscriptionByEmail } from "@/lib/billing/sync-checkout";
import { revalidateSubscriptionPages } from "@/lib/billing/revalidate-subscription";
import { getSubscriptionStatus } from "@/lib/stripe";
import {
  mapBillingSyncCodeToAppError,
  createAppError,
  respondWithError,
  toApiResponse,
} from "@/lib/errors";

const handleSync = withAuth(
  async (_request, { user }) => {
    if (!user.email) {
      return respondWithError("VALIDATION_ERROR");
    }

    try {
      const result = await syncActiveSubscriptionByEmail(user.id, user.email);

      if (!result.ok) {
        return toApiResponse(mapBillingSyncCodeToAppError(result.code));
      }

      const status = await getSubscriptionStatus(user.id);
      revalidateSubscriptionPages();
      return Response.json({
        pro: true,
        tier: status.tier,
        expiresAt: status.expiresAt,
      });
    } catch (error) {
      console.error("[api/billing/sync]", error);
      return toApiResponse(
        createAppError("STRIPE_ERROR", { details: error })
      );
    }
  },
  { rateLimit: { scope: "billing-sync", limit: 10 } }
);

/** Recover Pro from Stripe by account email (e.g. webhook missed). */
export async function POST(request: NextRequest, context: AppRouteContext) {
  if (!isStripeBillingConfigured()) {
    return respondWithError("STRIPE_ERROR", { statusCode: 503 });
  }

  return handleSync(request, context);
}
