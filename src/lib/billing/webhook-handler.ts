import type Stripe from "stripe";
import {
  applyStripeSubscriptionToUser,
  findUserIdByStripeCustomer,
} from "@/lib/billing/profile-billing";
import { extractSupabaseUserId } from "@/lib/billing/subscription-sync";
import {
  isStripeEventProcessed,
  markStripeEventType,
} from "@/lib/billing/webhook-idempotency";
import { getStripeClient } from "@/lib/billing/stripe-client";

async function resolveUserIdForSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = extractSupabaseUserId(subscription.metadata);
  if (fromMeta) return fromMeta;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return null;
  return findUserIdByStripeCustomer(customerId);
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId =
    extractSupabaseUserId(session.metadata) ??
    session.client_reference_id ??
    null;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId || !subscriptionId) {
    console.warn("[stripe/webhook] checkout.session.completed missing ids");
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const applied = await applyStripeSubscriptionToUser(userId, subscription);
  if (!applied) {
    throw new Error("Failed to update profile subscription");
  }
}

async function handleSubscriptionEvent(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = await resolveUserIdForSubscription(subscription);
  if (!userId) {
    console.warn(
      "[stripe/webhook] subscription event without user mapping",
      subscription.id
    );
    return;
  }

  const applied = await applyStripeSubscriptionToUser(userId, subscription);
  if (!applied) {
    throw new Error("Failed to update profile subscription");
  }
}

export type StripeWebhookHandleResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; status: number; error: string };

/** Process a verified Stripe webhook event (idempotent). */
export async function handleStripeWebhookEvent(
  event: Stripe.Event
): Promise<StripeWebhookHandleResult> {
  if (await isStripeEventProcessed(event.id)) {
    return { ok: true, skipped: true };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    await markStripeEventType(event.id, event.type);
    return { ok: true };
  } catch (error) {
    console.error("[stripe/webhook] handler error", event.type, error);
    return { ok: false, status: 500, error: "Webhook handler failed" };
  }
}

/** Verify signature and dispatch — shared by billing + webhooks routes. */
export async function processStripeWebhookRequest(
  rawBody: string,
  signature: string | null,
  webhookSecret: string
): Promise<StripeWebhookHandleResult | { ok: false; status: number; error: string }> {
  if (!signature) {
    return { ok: false, status: 400, error: "Missing signature" };
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe/webhook] signature verification failed", error);
    return { ok: false, status: 400, error: "Invalid signature" };
  }

  return handleStripeWebhookEvent(event);
}
