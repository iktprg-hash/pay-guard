import { describe, expect, it } from "vitest";
import {
  extractSupabaseUserId,
  getSubscriptionPeriodEnd,
  mapStripeSubscriptionToProfile,
} from "@/lib/billing/subscription-sync";
import type Stripe from "stripe";

function sub(
  overrides: Partial<Stripe.Subscription> & Pick<Stripe.Subscription, "status">
): Stripe.Subscription {
  return {
    id: "sub_1",
    customer: "cus_1",
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          current_period_end: 1_800_000_000,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: "/v1/subscription_items",
    },
    cancel_at: null,
    metadata: { supabase_user_id: "user-abc" },
    ...overrides,
  } as Stripe.Subscription;
}

describe("subscription-sync", () => {
  it("maps active subscription to pro tier", () => {
    const patch = mapStripeSubscriptionToProfile(sub({ status: "active" }));

    expect(patch.tier).toBe("pro");
    expect(patch.stripeSubscriptionId).toBe("sub_1");
    expect(patch.stripeCustomerId).toBe("cus_1");
    expect(patch.expiresAt).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });

  it("maps canceled subscription to free tier", () => {
    const patch = mapStripeSubscriptionToProfile(sub({ status: "canceled" }));

    expect(patch.tier).toBe("free");
    expect(patch.stripeSubscriptionId).toBeNull();
    expect(patch.expiresAt).toBeNull();
  });

  it("reads period end from first subscription item", () => {
    expect(getSubscriptionPeriodEnd(sub({ status: "active" }))).toBe(
      1_800_000_000
    );
  });

  it("extracts supabase user id from metadata", () => {
    expect(
      extractSupabaseUserId({ supabase_user_id: "  uuid-1  " })
    ).toBe("uuid-1");
    expect(extractSupabaseUserId({})).toBeNull();
  });
});
