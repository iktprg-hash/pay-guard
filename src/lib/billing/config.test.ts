import { describe, expect, it } from "vitest";
import {
  getStripeProPriceId,
  getStripeSecretKey,
  isStripeBillingConfigured,
} from "@/lib/billing/config";

describe("billing config", () => {
  it("is not configured without env vars", () => {
    expect(isStripeBillingConfigured()).toBe(false);
    expect(getStripeSecretKey()).toBeUndefined();
    expect(getStripeProPriceId()).toBeUndefined();
  });
});
