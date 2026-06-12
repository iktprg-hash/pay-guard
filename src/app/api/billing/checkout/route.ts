import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { userHasProAccess } from "@/lib/auth/subscription";
import {
  isStripeBillingConfigured,
  getStripeProPriceId,
  getStripeProPriceIdIssue,
} from "@/lib/billing/config";
import { getUserBillingRecord } from "@/lib/billing/profile-billing";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { resolveSiteOrigin } from "@/lib/site/url";
import {
  rateLimitError,
  serviceUnavailable,
  validationError,
} from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

const bodySchema = z.object({
  locale: z.enum(["cs", "ru", "en"]).default("cs"),
});

/** Create Stripe Checkout Session for Pay Guard Pro (CZK, Czech market). */
export async function POST(request: NextRequest) {
  if (!isStripeBillingConfigured()) {
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
    return serviceUnavailable("Billing is not configured");
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

  if (await userHasProAccess(auth.user.id)) {
    return NextResponse.json(
      { error: "Pro subscription already active", code: "already_pro" },
      { status: 409 }
    );
  }

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationError(parsed.error);

    const { locale } = parsed.data;
    const origin = resolveSiteOrigin(request);
    const priceId = getStripeProPriceId()!;
    const stripe = getStripeClient();
    const billing = await getUserBillingRecord(auth.user.id);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      locale: locale === "cs" ? "cs" : locale === "ru" ? "ru" : "en",
      client_reference_id: auth.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        supabase_user_id: auth.user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: auth.user.id,
        },
      },
      success_url: `${origin}/${locale}/pricing?checkout=success`,
      cancel_url: `${origin}/${locale}/pricing?checkout=cancelled`,
    };

    if (billing?.stripeCustomerId) {
      sessionParams.customer = billing.stripeCustomerId;
    } else if (auth.user.email) {
      sessionParams.customer_email = auth.user.email;
    } else {
      return NextResponse.json(
        {
          error: "Account email required for checkout",
          code: "email_required",
        },
        { status: 422 }
      );
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (firstError) {
      if (
        billing?.stripeCustomerId &&
        firstError instanceof Stripe.errors.StripeInvalidRequestError
      ) {
        session = await stripe.checkout.sessions.create({
          ...sessionParams,
          customer: undefined,
          customer_email: auth.user.email ?? undefined,
        });
      } else {
        throw firstError;
      }
    }

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not start checkout" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[api/billing/checkout]", error);
    const detail =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : undefined;
    return NextResponse.json(
      { error: "Checkout failed", code: "stripe_error", detail },
      { status: 500 }
    );
  }
}
