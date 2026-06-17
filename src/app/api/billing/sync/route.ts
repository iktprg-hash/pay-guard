import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AppRouteContext } from "@/lib/api/protected";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { syncActiveSubscriptionByEmail, describeBillingSyncClientError } from "@/lib/billing/sync-checkout";
import { revalidateSubscriptionPages } from "@/lib/billing/revalidate-subscription";
import { getSubscriptionStatus } from "@/lib/stripe";
import { serviceUnavailable } from "@/lib/api/errors";

const handleSync = withAuth(
  async (_request, { user }) => {
    if (!user.email) {
      return NextResponse.json(
        { error: "Account email required", code: "email_required" },
        { status: 422 }
      );
    }

    try {
      const result = await syncActiveSubscriptionByEmail(user.id, user.email);

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
      console.error("[api/billing/sync]", error);
      return NextResponse.json({ error: "Sync failed" }, { status: 500 });
    }
  },
  { rateLimit: { scope: "billing-sync", limit: 10 } }
);

/** Recover Pro from Stripe by account email (e.g. webhook missed). */
export async function POST(request: NextRequest, context: AppRouteContext) {
  if (!isStripeBillingConfigured()) {
    return serviceUnavailable("Billing is not configured");
  }

  return handleSync(request, context);
}
