import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  createCheckoutSession,
  StripeServiceError,
} from "@/lib/stripe";
import { getStripeProPriceIdIssue } from "@/lib/billing/config";
import { getUserBillingRecord } from "@/lib/billing/profile-billing";
import { resolveSiteOrigin } from "@/lib/site/url";
import {
  rateLimitError,
  serviceUnavailable,
  validationError,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { billingLocaleBodySchema } from "@/lib/validation/schemas";

/** Create Stripe Checkout Session for Pay Guard Pro (CZK, Czech market). */
export async function POST(request: NextRequest) {
  const priceIssue = getStripeProPriceIdIssue();
  if (priceIssue === "product_id_not_price") {
    return NextResponse.json(
      {
        error: "STRIPE_PRO_PRICE_ID must be a Price id (price_…), not Product id (prod_…)",
        code: "invalid_price_id",
      },
      { status: 503 }
    );
  }

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `billing-checkout:${auth.user.id}:${ip}`,
    10,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const parsed = await parseJsonBody(request, billingLocaleBodySchema);
    if (!parsed.ok) return validationError(parsed.error);

    const { locale } = parsed.data;
    const origin = resolveSiteOrigin(request);
    const billing = await getUserBillingRecord(auth.user.id);

    const { url } = await createCheckoutSession(auth.user.id, undefined, {
      locale,
      origin,
      email: auth.user.email,
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
          { error: error.message, code: "already_pro" },
          { status: 409 }
        );
      }
      if (error.code === "email_required") {
        return NextResponse.json(
          { error: error.message, code: "email_required" },
          { status: 422 }
        );
      }
    }

    console.error("[api/billing/checkout]", error);
    const detail =
      error instanceof Error ? error.message : undefined;
    return NextResponse.json(
      { error: "Checkout failed", code: "stripe_error", detail },
      { status: 500 }
    );
  }
}
