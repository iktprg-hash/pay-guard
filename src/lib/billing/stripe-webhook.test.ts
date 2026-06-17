import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import {
  applyProfileSubscriptionPatch,
  applyStripeSubscriptionToUser,
  findUserIdByStripeCustomer,
} from "@/lib/billing/profile-billing";
import { getStripeClient } from "@/lib/billing/stripe-client";
import {
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleSubscriptionEvent,
} from "@/lib/billing/stripe-webhook";

vi.mock("@/lib/billing/profile-billing", () => ({
  applyProfileSubscriptionPatch: vi.fn(),
  applyStripeSubscriptionToUser: vi.fn(),
  findUserIdByStripeCustomer: vi.fn(),
}));

vi.mock("@/lib/billing/stripe-client", () => ({
  getStripeClient: vi.fn(),
}));

const retrieve = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStripeClient).mockReturnValue({
    subscriptions: { retrieve },
  } as unknown as ReturnType<typeof getStripeClient>);
  vi.mocked(applyStripeSubscriptionToUser).mockResolvedValue(true);
  vi.mocked(applyProfileSubscriptionPatch).mockResolvedValue(true);
  vi.mocked(findUserIdByStripeCustomer).mockResolvedValue("user-1");
});

function subscription(status: Stripe.Subscription.Status): Stripe.Subscription {
  return {
    id: "sub_1",
    customer: "cus_1",
    status,
    metadata: { supabase_user_id: "user-abc" },
    items: { data: [{ current_period_end: 1_900_000_000 }] },
  } as Stripe.Subscription;
}

describe("stripe-webhook handlers", () => {
  it("extends Pro on invoice.payment_succeeded via subscription retrieve", async () => {
    retrieve.mockResolvedValue(subscription("active"));

    const outcome = await handleInvoicePaymentSucceeded({
      id: "in_1",
      subscription: "sub_1",
      customer: "cus_1",
      metadata: {},
    } as Stripe.Invoice);

    expect(outcome.profileUpdated).toBe(true);
    expect(applyStripeSubscriptionToUser).toHaveBeenCalledWith(
      "user-abc",
      expect.objectContaining({ id: "sub_1" })
    );
  });

  it("revokes Pro on invoice.payment_failed", async () => {
    const outcome = await handleInvoicePaymentFailed({
      id: "in_fail",
      customer: "cus_1",
      metadata: { supabase_user_id: "user-abc" },
    } as Stripe.Invoice);

    expect(outcome.userId).toBe("user-abc");
    expect(outcome.profileUpdated).toBe(true);
    expect(applyProfileSubscriptionPatch).toHaveBeenCalledWith("user-abc", {
      tier: "free",
      expiresAt: null,
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
    });
  });

  it("maps customer.subscription.deleted to free tier via subscription sync", async () => {
    await handleSubscriptionEvent(subscription("canceled"));

    expect(applyStripeSubscriptionToUser).toHaveBeenCalledWith(
      "user-abc",
      expect.objectContaining({ status: "canceled" })
    );
  });
});
