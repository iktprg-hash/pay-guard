import type Stripe from "stripe";
import type { SubscriptionTier } from "@/lib/types/financial";

export interface ProfileSubscriptionPatch {
  tier: SubscriptionTier;
  expiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

const PRO_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

export function getSubscriptionPeriodEnd(
  subscription: Stripe.Subscription
): number | null {
  const itemEnd = subscription.items?.data?.[0]?.current_period_end;
  if (itemEnd) return itemEnd;
  if (subscription.cancel_at) return subscription.cancel_at;
  return null;
}

/** Map Stripe subscription → profile fields (pure, testable). */
export function mapStripeSubscriptionToProfile(
  subscription: Pick<Stripe.Subscription, "id" | "customer" | "status" | "items" | "cancel_at">
): ProfileSubscriptionPatch {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const pro = PRO_STATUSES.has(subscription.status);
  const periodEnd = getSubscriptionPeriodEnd(subscription as Stripe.Subscription);
  const expiresAt =
    pro && periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

  return {
    tier: pro ? "pro" : "free",
    expiresAt,
    stripeCustomerId: customerId,
    stripeSubscriptionId: pro ? subscription.id : null,
  };
}

export function extractSupabaseUserId(
  metadata: Stripe.Metadata | null | undefined
): string | null {
  const id = metadata?.supabase_user_id?.trim();
  return id || null;
}

export function profilePatchToRow(patch: ProfileSubscriptionPatch) {
  return {
    subscription_tier: patch.tier,
    subscription_expires_at: patch.expiresAt,
    stripe_customer_id: patch.stripeCustomerId,
    stripe_subscription_id: patch.stripeSubscriptionId,
    updated_at: new Date().toISOString(),
  };
}
