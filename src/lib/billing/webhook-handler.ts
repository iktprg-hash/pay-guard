import type Stripe from "stripe";
import {
  applyStripeSubscriptionToUser,
  findUserIdByStripeCustomer,
} from "@/lib/billing/profile-billing";
import { revalidateSubscriptionPages } from "@/lib/billing/revalidate-subscription";
import { extractSupabaseUserId } from "@/lib/billing/subscription-sync";
import {
  isStripeEventProcessed,
  markStripeEventType,
  releaseStripeEventLock,
} from "@/lib/billing/webhook-idempotency";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { createServiceClient } from "@/lib/supabase/service";

export const STRIPE_WEBHOOK_MAX_BODY_BYTES = 1_000_000;

export const SUBSCRIPTION_WEBHOOK_EVENTS = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

interface HandlerOutcome {
  userId: string | null;
  profileUpdated: boolean;
}

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
): Promise<HandlerOutcome> {
  const userId =
    extractSupabaseUserId(session.metadata) ??
    session.client_reference_id ??
    null;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId || !subscriptionId) {
    console.warn("[stripe/webhook] checkout.session.completed missing ids", {
      sessionId: session.id,
      userId,
      subscriptionId,
    });
    return { userId, profileUpdated: false };
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const applied = await applyStripeSubscriptionToUser(userId, subscription);
  if (!applied) {
    throw new Error("Failed to update profile subscription");
  }

  return { userId, profileUpdated: true };
}

async function handleSubscriptionEvent(
  subscription: Stripe.Subscription
): Promise<HandlerOutcome> {
  const userId = await resolveUserIdForSubscription(subscription);
  if (!userId) {
    console.warn("[stripe/webhook] subscription event without user mapping", {
      subscriptionId: subscription.id,
      status: subscription.status,
    });
    return { userId: null, profileUpdated: false };
  }

  const applied = await applyStripeSubscriptionToUser(userId, subscription);
  if (!applied) {
    throw new Error("Failed to update profile subscription");
  }

  return { userId, profileUpdated: true };
}

export type StripeWebhookHandleResult =
  | {
      ok: true;
      skipped?: boolean;
      warning?: string;
      eventId: string;
      eventType: string;
      userId?: string | null;
      profileUpdated?: boolean;
    }
  | { ok: false; status: number; error: string };

/** Process a verified Stripe webhook event (idempotent). */
export async function handleStripeWebhookEvent(
  event: Stripe.Event
): Promise<StripeWebhookHandleResult> {
  if (
    process.env.NODE_ENV === "production" &&
    !createServiceClient()
  ) {
    return {
      ok: false,
      status: 503,
      error: "Webhook idempotency unavailable",
    };
  }

  if (await isStripeEventProcessed(event.id)) {
    return {
      ok: true,
      skipped: true,
      eventId: event.id,
      eventType: event.type,
    };
  }

  let outcome: HandlerOutcome = { userId: null, profileUpdated: false };

  try {
    switch (event.type) {
      case "checkout.session.completed":
        outcome = await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        outcome = await handleSubscriptionEvent(
          event.data.object as Stripe.Subscription
        );
        break;
      default:
        break;
    }

    await markStripeEventType(event.id, event.type);

    if (SUBSCRIPTION_WEBHOOK_EVENTS.has(event.type)) {
      revalidateSubscriptionPages();
    }

    return {
      ok: true,
      eventId: event.id,
      eventType: event.type,
      userId: outcome.userId,
      profileUpdated: outcome.profileUpdated,
    };
  } catch (error) {
    console.error("[stripe/webhook] handler error", {
      eventId: event.id,
      eventType: event.type,
      userId: outcome.userId,
      error,
    });

    await releaseStripeEventLock(event.id);

    return {
      ok: false,
      status: 500,
      error: "Webhook handler failed",
    };
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
