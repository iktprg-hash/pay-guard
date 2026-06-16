import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  describeStripeBillingIssue,
  getStripeBillingConfigStatus,
  getStripeProPriceId,
  getStripeProPriceIdIssue,
  getStripeSecretKeyIssue,
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
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(isStripeBillingConfigured()).toBe(false);
    const status = getStripeBillingConfigStatus();
    expect(status.checkoutEnabled).toBe(false);
    expect(status.checkoutBlocker).toBe("missing_secret_key");
    expect(status.webhookConfigured).toBe(false);
  });

  it("rejects product id used instead of price id", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.STRIPE_PRO_PRICE_ID = "prod_123";
    expect(getStripeProPriceIdIssue()).toBe("product_id_not_price");
    expect(getStripeProPriceId()).toBeUndefined();
    expect(isStripeBillingConfigured()).toBe(false);
    expect(getStripeBillingConfigStatus().checkoutBlocker).toBe(
      "product_id_not_price"
    );
  });

  it("enables checkout when secret and price are valid", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.STRIPE_PRO_PRICE_ID = "price_123";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const status = getStripeBillingConfigStatus();
    expect(status.checkoutEnabled).toBe(true);
    expect(status.checkoutBlocker).toBeNull();
    expect(status.webhookConfigured).toBe(false);
    expect(status.issues).toContain("missing_webhook_secret");
  });

  it("describes issues for operators", () => {
    expect(describeStripeBillingIssue("missing_secret_key")).toContain(
      "STRIPE_SECRET_KEY"
    );
    expect(getStripeSecretKeyIssue()).toBe("missing");
  });
});
