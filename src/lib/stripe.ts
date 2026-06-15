/**
 * Pay Guard — Stripe billing service (production + test mode).
 *
 * Wraps checkout, customer portal, and subscription status reads.
 * Uses STRIPE_SECRET_KEY / STRIPE_PRO_PRICE_ID from env (see billing/config).
 */

import Stripe from "stripe";
import type StripeNS from "stripe";
import {
  getUserSubscription,
  isActivePro,
  type UserSubscription,
} from "@/lib/auth/subscription";
import {
  getStripeProPriceId,
  isStripeBillingConfigured,
} from "@/lib/billing/config";
import {
  applyStripeSubscriptionToUser,
  getUserBillingRecord,
} from "@/lib/billing/profile-billing";
import { getStripeClient } from "@/lib/billing/stripe-client";
import type { SubscriptionTier } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

export class StripeServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "already_pro"
      | "email_required"
      | "no_customer"
      | "stripe_error"
  ) {
    super(message);
    this.name = "StripeServiceError";
  }
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Live Stripe subscription status when id is known */
  stripeStatus?: StripeNS.Subscription.Status;
  testMode: boolean;
}

export interface CreateCheckoutSessionOptions {
  priceId?: string;
  email?: string | null;
  locale?: Locale;
  origin: string;
  existingCustomerId?: string | null;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface CreatePortalSessionOptions {
  returnUrl: string;
}

export interface CreatePortalSessionResult {
  url: string;
}

function isTestModeKey(key: string): boolean {
  return key.startsWith("sk_test_");
}

/** Read subscription tier from profiles (+ optional live Stripe refresh). */
export async function getSubscriptionStatus(
  userId: string,
  options?: { refreshFromStripe?: boolean }
): Promise<SubscriptionStatus> {
  const subscription: UserSubscription = await getUserSubscription(userId);
  const billing = await getUserBillingRecord(userId);

  let stripeStatus: StripeNS.Subscription.Status | undefined;
  let tier = subscription.tier;
  let expiresAt = subscription.expiresAt;

  if (
    options?.refreshFromStripe &&
    billing?.stripeSubscriptionId &&
    isStripeBillingConfigured()
  ) {
    try {
      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(
        billing.stripeSubscriptionId
      );
      stripeStatus = sub.status;
      const periodEnd = sub.items?.data?.[0]?.current_period_end;
      if (periodEnd && ["active", "trialing", "past_due"].includes(sub.status)) {
        tier = "pro";
        expiresAt = new Date(periodEnd * 1000).toISOString();
      } else if (sub.status === "canceled" || sub.status === "unpaid") {
        tier = "free";
        expiresAt = null;
      }
    } catch (error) {
      console.error("[stripe] refresh subscription failed", error);
    }
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  return {
    tier,
    isActive: isActivePro({ tier, expiresAt }),
    expiresAt,
    stripeCustomerId: billing?.stripeCustomerId ?? null,
    stripeSubscriptionId: billing?.stripeSubscriptionId ?? null,
    stripeStatus,
    testMode: secretKey ? isTestModeKey(secretKey) : true,
  };
}

/** Create Stripe Checkout for Pay Guard Pro subscription. */
export async function createCheckoutSession(
  userId: string,
  priceId: string | undefined,
  options: Omit<CreateCheckoutSessionOptions, "priceId">
): Promise<CreateCheckoutSessionResult> {
  if (!isStripeBillingConfigured()) {
    throw new StripeServiceError(
      "Billing is not configured",
      "not_configured"
    );
  }

  const resolvedPriceId = priceId ?? getStripeProPriceId();
  if (!resolvedPriceId) {
    throw new StripeServiceError(
      "STRIPE_PRO_PRICE_ID is not configured",
      "not_configured"
    );
  }

  const status = await getSubscriptionStatus(userId);
  if (status.isActive) {
    throw new StripeServiceError(
      "Pro subscription already active",
      "already_pro"
    );
  }

  const billing = await getUserBillingRecord(userId);
  const customerId =
    options.existingCustomerId ?? billing?.stripeCustomerId ?? undefined;

  const locale = options.locale ?? "cs";
  const origin = options.origin;
  const stripe = getStripeClient();

  const sessionParams: StripeNS.Checkout.SessionCreateParams = {
    mode: "subscription",
    locale: locale === "cs" ? "cs" : locale === "ru" ? "ru" : "en",
    client_reference_id: userId,
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata: { supabase_user_id: userId },
    subscription_data: {
      metadata: { supabase_user_id: userId },
    },
    success_url: `${origin}/${locale}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${locale}/pricing?checkout=cancelled`,
  };

  if (customerId) {
    sessionParams.customer = customerId;
  } else if (options.email) {
    sessionParams.customer_email = options.email;
  } else {
    throw new StripeServiceError(
      "Account email required for checkout",
      "email_required"
    );
  }

  let session: StripeNS.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (firstError) {
    if (
      customerId &&
      firstError instanceof Stripe.errors.StripeInvalidRequestError &&
      options.email
    ) {
      session = await stripe.checkout.sessions.create({
        ...sessionParams,
        customer: undefined,
        customer_email: options.email,
      });
    } else {
      throw firstError;
    }
  }

  if (!session.url || !session.id) {
    throw new StripeServiceError("Could not start checkout", "stripe_error");
  }

  return { sessionId: session.id, url: session.url };
}

/** Open Stripe Customer Portal for subscription management. */
export async function createCustomerPortalSession(
  userId: string,
  options: CreatePortalSessionOptions
): Promise<CreatePortalSessionResult> {
  if (!isStripeBillingConfigured()) {
    throw new StripeServiceError(
      "Billing is not configured",
      "not_configured"
    );
  }

  const billing = await getUserBillingRecord(userId);
  if (!billing?.stripeCustomerId) {
    throw new StripeServiceError("No billing account found", "no_customer");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: options.returnUrl,
  });

  if (!session.url) {
    throw new StripeServiceError("Could not open portal", "stripe_error");
  }

  return { url: session.url };
}

/**
 * Force-sync subscription tier from Stripe into profiles.
 * Uses stored subscription id, or falls back to the customer's latest subscription.
 */
export async function syncSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  if (!isStripeBillingConfigured()) {
    return getSubscriptionStatus(userId);
  }

  const billing = await getUserBillingRecord(userId);
  if (!billing?.stripeSubscriptionId && !billing?.stripeCustomerId) {
    return getSubscriptionStatus(userId);
  }

  const stripe = getStripeClient();
  let subscription: StripeNS.Subscription | null = null;

  if (billing.stripeSubscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(
        billing.stripeSubscriptionId
      );
    } catch (error) {
      console.error("[stripe] sync retrieve subscription failed", {
        userId,
        subscriptionId: billing.stripeSubscriptionId,
        error,
      });
    }
  }

  if (!subscription && billing.stripeCustomerId) {
    try {
      const list = await stripe.subscriptions.list({
        customer: billing.stripeCustomerId,
        status: "all",
        limit: 1,
      });
      subscription = list.data[0] ?? null;
    } catch (error) {
      console.error("[stripe] sync list subscriptions failed", {
        userId,
        customerId: billing.stripeCustomerId,
        error,
      });
    }
  }

  if (subscription) {
    const applied = await applyStripeSubscriptionToUser(userId, subscription);
    if (!applied) {
      console.error("[stripe] sync profile update failed", { userId });
    }
  }

  return getSubscriptionStatus(userId);
}
