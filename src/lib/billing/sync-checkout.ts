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

/**
 * Resolve owner user id from Stripe metadata (checkout / webhook convention).
 * Deny-by-default: empty or missing metadata must not grant access.
 */
function ownerUserIdFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | null {
  const raw =
    metadata?.supabase_user_id ?? metadata?.client_reference_id ?? null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Strict subscription ownership for email-based sync recovery.
 * Email match alone is never sufficient — metadata must tie the subscription
 * (or its customer) to the Supabase user id.
 */
function subscriptionBelongsToUser(
  subscription: Stripe.Subscription,
  userId: string,
  customer?: Stripe.Customer | Stripe.DeletedCustomer | null
): boolean {
  const subscriptionOwner = ownerUserIdFromStripeMetadata(subscription.metadata);

  const customerRecord =
    customer && "deleted" in customer && customer.deleted
      ? null
      : (customer as Stripe.Customer | null | undefined);

  const customerOwner = customerRecord
    ? ownerUserIdFromStripeMetadata(customerRecord.metadata)
    : null;

  const ownerId = subscriptionOwner ?? customerOwner;
  if (!ownerId) return false;

  return ownerId === userId;
}

async function resolveSubscriptionCustomer(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<Stripe.Customer | null> {
  const raw = subscription.customer;
  if (!raw) return null;

  if (typeof raw === "object") {
    if ("deleted" in raw && raw.deleted) return null;
    return raw;
  }

  try {
    const customer = await stripe.customers.retrieve(raw);
    if ("deleted" in customer && customer.deleted) return null;
    return customer;
  } catch {
    return null;
  }
}

async function applySubscriptionId(
  userId: string,
  subscriptionId: string
): Promise<BillingSyncResult> {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customer = await resolveSubscriptionCustomer(stripe, subscription);

  if (!subscriptionBelongsToUser(subscription, userId, customer)) {
    return { ok: false, code: "session_mismatch" };
  }

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
      if (!subscriptionBelongsToUser(active, userId, customer)) {
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
