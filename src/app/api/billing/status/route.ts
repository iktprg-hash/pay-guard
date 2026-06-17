import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/protected";
import { getSubscriptionStatus } from "@/lib/stripe";
import { respondWithValidationError } from "@/lib/errors";
import { parseQueryParams } from "@/lib/api/parse-request";
import { emptyQuerySchema } from "@/lib/validation/schemas";

/** Current Stripe subscription status for authenticated client polling. */
export const GET = withAuth(
  async (_request, { user }) => {
    const query = parseQueryParams(_request, emptyQuerySchema);
    if (!query.ok) return respondWithValidationError(query.error);

    const status = await getSubscriptionStatus(user.id);

    return NextResponse.json({
      tier: status.tier,
      isActive: status.isActive,
      expiresAt: status.expiresAt,
      testMode: status.testMode,
    });
  },
  { rateLimit: { scope: "billing-status", limit: 30 } }
);
