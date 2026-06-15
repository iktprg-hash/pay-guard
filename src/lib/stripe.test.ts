import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isProEnabledForProfile,
  isProEnabledForSubscription,
} from "@/lib/supabase/pro-access";

describe("pro-access", () => {
  it("isProEnabledForSubscription respects expiry", () => {
    expect(
      isProEnabledForSubscription("pro", "2099-01-01T00:00:00.000Z")
    ).toBe(true);
    expect(
      isProEnabledForSubscription("pro", "2020-01-01T00:00:00.000Z")
    ).toBe(false);
    expect(isProEnabledForSubscription("free", null)).toBe(false);
  });

  it("isProEnabledForProfile mirrors subscription helper", () => {
    expect(
      isProEnabledForProfile({
        subscriptionTier: "pro_max",
        subscriptionExpiresAt: null,
      })
    ).toBe(true);
  });
});

describe("getSubscriptionStatus", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("maps profile subscription to status", async () => {
    vi.doMock("@/lib/auth/subscription", () => ({
      getUserSubscription: vi.fn().mockResolvedValue({
        tier: "pro",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      isActivePro: (s: { tier: string; expiresAt: string | null }) =>
        s.tier === "pro",
    }));
    vi.doMock("@/lib/billing/profile-billing", () => ({
      getUserBillingRecord: vi.fn().mockResolvedValue({
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      }),
    }));

    const { getSubscriptionStatus } = await import("@/lib/stripe");
    const status = await getSubscriptionStatus("user-1");

    expect(status.tier).toBe("pro");
    expect(status.isActive).toBe(true);
    expect(status.stripeCustomerId).toBe("cus_1");
  });
});
