import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getStripeProPriceId,
  getStripeProPriceIdIssue,
  isStripeBillingConfigured,
} from "@/lib/billing/config";

describe("billing config", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("is not configured without env vars", () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRO_PRICE_ID;
    expect(isStripeBillingConfigured()).toBe(false);
  });

  it("rejects product id used instead of price id", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.STRIPE_PRO_PRICE_ID = "prod_123";
    expect(getStripeProPriceIdIssue()).toBe("product_id_not_price");
    expect(getStripeProPriceId()).toBeUndefined();
    expect(isStripeBillingConfigured()).toBe(false);
  });
});
