import type Stripe from "stripe";
import {
  applyStripeSubscriptionToUser,
} from "@/lib/billing/profile-billing";
import { extractSupabaseUserId } from "@/lib/billing/subscription-sync";
import { getStripeClient } from "@/lib/billing/stripe-client";

export type BillingSyncResult =
  | { ok: true }
  | { ok: false; code: string; detail?: string };

function sessionBelongsToUser(
  session: Stripe.Checkout.Session,
  userId: string
): boolean {
  return (
    session.client_reference_id === userId ||
    extractSupabaseUserId(session.metadata) === userId
  );
}

async function applySubscriptionId(
  userId: string,
  subscriptionId: string
): Promise<BillingSyncResult> {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const applied = await applyStripeSubscriptionToUser(userId, subscription);
  if (!applied) {
    return {
      ok: false,
      code: "profile_update_failed",
      detail: "Could not update profile (check SUPABASE_SERVICE_ROLE_KEY)",
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
  const session = await stripe.checkout.sessions.retrieve(sessionId);

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
      const applied = await applyStripeSubscriptionToUser(userId, active);
      if (!applied) {
        return {
          ok: false,
          code: "profile_update_failed",
          detail: "Could not update profile (check SUPABASE_SERVICE_ROLE_KEY)",
        };
      }
      return { ok: true };
    }
  }

  return { ok: false, code: "no_active_subscription" };
}
