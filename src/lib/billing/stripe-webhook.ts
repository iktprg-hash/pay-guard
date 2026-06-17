import type Stripe from "stripe";
import {
  applyProfileSubscriptionPatch,
  applyStripeSubscriptionToUser,
  findUserIdByStripeCustomer,
} from "@/lib/billing/profile-billing";
import { extractSupabaseUserId } from "@/lib/billing/subscription-sync";
import { getStripeClient } from "@/lib/billing/stripe-client";

export interface StripeWebhookHandlerOutcome {
  userId: string | null;
  profileUpdated: boolean;
}

/** Stripe events that mutate subscription state in profiles. */
export const BILLING_WEBHOOK_EVENTS = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

function stripeCustomerId(
  customer: Stripe.Customer | Stripe.DeletedCustomer | string | null | undefined
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.id;
}

/** Subscription id from invoice — supports current Stripe API (`parent`) and legacy payloads. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (fromParent) {
    return typeof fromParent === "string" ? fromParent : fromParent.id;
  }

  const legacy = (invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  }).subscription;
  if (!legacy) return null;
  return typeof legacy === "string" ? legacy : legacy.id;
}

export async function resolveUserIdFromInvoice(
  invoice: Stripe.Invoice
): Promise<string | null> {
  const fromMeta = extractSupabaseUserId(invoice.metadata);
  if (fromMeta) return fromMeta;

  const subscriptionId = invoiceSubscriptionId(invoice);

  if (subscriptionId) {
    try {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const fromSubMeta = extractSupabaseUserId(subscription.metadata);
      if (fromSubMeta) return fromSubMeta;

      const customerId = stripeCustomerId(subscription.customer);
      if (customerId) {
        return findUserIdByStripeCustomer(customerId);
      }
    } catch (error) {
      console.error("[stripe/webhook] subscription retrieve failed", {
        subscriptionId,
        error,
      });
    }
  }

  const customerId = stripeCustomerId(invoice.customer);
  if (!customerId) return null;
  return findUserIdByStripeCustomer(customerId);
}

export async function resolveUserIdForSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = extractSupabaseUserId(subscription.metadata);
  if (fromMeta) return fromMeta;

  const customerId = stripeCustomerId(subscription.customer);
  if (!customerId) return null;
  return findUserIdByStripeCustomer(customerId);
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<StripeWebhookHandlerOutcome> {
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

export async function handleSubscriptionEvent(
  subscription: Stripe.Subscription
): Promise<StripeWebhookHandlerOutcome> {
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

/** Renew Pro access after a successful invoice payment. */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<StripeWebhookHandlerOutcome> {
  const subscriptionId = invoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    console.info("[stripe/webhook] invoice.payment_succeeded without subscription", {
      invoiceId: invoice.id,
    });
    return { userId: null, profileUpdated: false };
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return handleSubscriptionEvent(subscription);
}

/** Revoke Pro immediately when payment fails (do not rely on past_due grace). */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<StripeWebhookHandlerOutcome> {
  const userId = await resolveUserIdFromInvoice(invoice);
  if (!userId) {
    console.warn("[stripe/webhook] invoice.payment_failed without user mapping", {
      invoiceId: invoice.id,
    });
    return { userId: null, profileUpdated: false };
  }

  const customerId = stripeCustomerId(invoice.customer);
  const applied = await applyProfileSubscriptionPatch(userId, {
    tier: "free",
    expiresAt: null,
    stripeCustomerId: customerId,
    stripeSubscriptionId: null,
  });

  if (!applied) {
    throw new Error("Failed to revoke profile subscription after payment failure");
  }

  return { userId, profileUpdated: true };
}

export function logStripeWebhookEvent(
  phase: "received" | "duplicate" | "success" | "warning" | "error",
  event: Pick<Stripe.Event, "id" | "type">,
  details?: Record<string, unknown>
): void {
  const payload = {
    eventId: event.id,
    eventType: event.type,
    ...details,
  };

  switch (phase) {
    case "duplicate":
      console.info("[stripe/webhook] duplicate skipped", payload);
      break;
    case "success":
      console.info("[stripe/webhook] success", payload);
      break;
    case "warning":
      console.warn("[stripe/webhook] handled with warning", payload);
      break;
    case "error":
      console.error("[stripe/webhook] handler error", payload);
      break;
    default:
      console.info("[stripe/webhook] received", payload);
  }
}
