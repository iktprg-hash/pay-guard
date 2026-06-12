import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeWebhookSecret } from "@/lib/billing/config";
import {
  applyStripeSubscriptionToUser,
  findUserIdByStripeCustomer,
} from "@/lib/billing/profile-billing";
import { extractSupabaseUserId } from "@/lib/billing/subscription-sync";
import { getStripeClient } from "@/lib/billing/stripe-client";

export const runtime = "nodejs";

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
    console.warn("[billing/webhook] checkout.session.completed missing ids");
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await applyStripeSubscriptionToUser(userId, subscription);
}

async function handleSubscriptionEvent(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = await resolveUserIdForSubscription(subscription);
  if (!userId) {
    console.warn(
      "[billing/webhook] subscription event without user mapping",
      subscription.id
    );
    return;
  }

  await applyStripeSubscriptionToUser(userId, subscription);
}

/** Stripe webhook — updates profiles.subscription_* via service role. */
export async function POST(request: NextRequest) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("[billing/webhook] signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("[billing/webhook] handler error", event.type, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
