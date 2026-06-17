import type Stripe from "stripe";
import {
  isStripeEventProcessed,
  markStripeEventType,
  releaseStripeEventLock,
} from "@/lib/billing/webhook-idempotency";
import { revalidateSubscriptionPages } from "@/lib/billing/revalidate-subscription";
import {
  BILLING_WEBHOOK_EVENTS,
  handleCheckoutCompleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleSubscriptionEvent,
  logStripeWebhookEvent,
  type StripeWebhookHandlerOutcome,
} from "@/lib/billing/stripe-webhook";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { createServiceClient } from "@/lib/supabase/service";

export const STRIPE_WEBHOOK_MAX_BODY_BYTES = 1_000_000;

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

async function dispatchStripeEvent(
  event: Stripe.Event
): Promise<StripeWebhookHandlerOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionEvent(event.data.object as Stripe.Subscription);
    case "invoice.payment_succeeded":
      return handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    default:
      return { userId: null, profileUpdated: false };
  }
}

/** Process a verified Stripe webhook event (idempotent). */
export async function handleStripeWebhookEvent(
  event: Stripe.Event
): Promise<StripeWebhookHandleResult> {
  if (process.env.NODE_ENV === "production" && !createServiceClient()) {
    return {
      ok: false,
      status: 503,
      error: "Webhook idempotency unavailable",
    };
  }

  logStripeWebhookEvent("received", event);

  if (await isStripeEventProcessed(event.id)) {
    return {
      ok: true,
      skipped: true,
      eventId: event.id,
      eventType: event.type,
    };
  }

  let outcome: StripeWebhookHandlerOutcome = {
    userId: null,
    profileUpdated: false,
  };

  try {
    outcome = await dispatchStripeEvent(event);

    await markStripeEventType(event.id, event.type);

    if (BILLING_WEBHOOK_EVENTS.has(event.type)) {
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
    logStripeWebhookEvent("error", event, {
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
