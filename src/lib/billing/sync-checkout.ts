import type Stripe from "stripe";
import {
  applyStripeSubscriptionToUser,
} from "@/lib/billing/profile-billing";
import { extractSupabaseUserId } from "@/lib/billing/subscription-sync";
import { getStripeClient } from "@/lib/billing/stripe-client";

export type BillingSyncResult =
  | { ok: true }
  | { ok: false; code: string };

/** User-safe message for billing sync/confirm API responses (no internal ops details). */
export function describeBillingSyncClientError(code: string): string {
  switch (code) {
    case "session_mismatch":
      return "This checkout session does not belong to your account.";
    case "session_incomplete":
      return "Payment is still processing. Please wait a moment and try again.";
    case "no_subscription":
      return "No subscription was found for this checkout.";
    case "profile_update_failed":
      return "Could not activate Pro yet. Please try again.";
    case "customer_not_found":
      return "No billing account was found for your email.";
    case "no_active_subscription":
      return "No active subscription was found.";
    default:
      return "Could not complete billing sync.";
  }
}

function sessionBelongsToUser(
  session: Stripe.Checkout.Session,
  userId: string
): boolean {
  return (
    session.client_reference_id === userId ||
    extractSupabaseUserId(session.metadata) === userId
  );
}

function subscriptionBelongsToUser(
  subscription: Stripe.Subscription,
  userId: string
): boolean {
  const metaUserId =
    subscription.metadata?.supabase_user_id ??
    subscription.metadata?.client_reference_id;

  if (metaUserId && metaUserId !== userId) {
    return false;
  }

  return true;
}

async function applySubscriptionId(
  userId: string,
  subscriptionId: string
): Promise<BillingSyncResult> {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const applied = await applyStripeSubscriptionToUser(userId, subscription);
  if (!applied) {
    console.error(
      "[billing/sync-checkout] profile update failed — check SUPABASE_SERVICE_ROLE_KEY"
    );
    return {
      ok: false,
      code: "profile_update_failed",
    };
  }
  return { ok: true };
}

/** Sync Pro after redirect from Checkout (session_id in URL). */
export async function syncCheckoutSessionForUser(
  userId: string,
  sessionId: string
): Promise<BillingSyncResult> {
  const stripe = getStripeClient();

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return { ok: false, code: "session_incomplete" };
  }

  if (!sessionBelongsToUser(session, userId)) {
    return { ok: false, code: "session_mismatch" };
  }

  if (session.status !== "complete") {
    return { ok: false, code: "session_incomplete" };
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    return { ok: false, code: "no_subscription" };
  }

  return applySubscriptionId(userId, subscriptionId);
}

/** Recover Pro by finding an active Stripe subscription for the user's email. */
export async function syncActiveSubscriptionByEmail(
  userId: string,
  email: string
): Promise<BillingSyncResult> {
  const stripe = getStripeClient();
  const customers = await stripe.customers.list({ email, limit: 5 });

  if (customers.data.length === 0) {
    return { ok: false, code: "customer_not_found" };
  }

  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 5,
    });

    const active = subscriptions.data.find((sub) =>
      ["active", "trialing", "past_due"].includes(sub.status)
    );

    if (active) {
      if (!subscriptionBelongsToUser(active, userId)) {
        return { ok: false, code: "session_mismatch" };
      }

      const applied = await applyStripeSubscriptionToUser(userId, active);
      if (!applied) {
        console.error(
          "[billing/sync-checkout] profile update failed — check SUPABASE_SERVICE_ROLE_KEY"
        );
        return {
          ok: false,
          code: "profile_update_failed",
        };
      }
      return { ok: true };
    }
  }

  return { ok: false, code: "no_active_subscription" };
}
