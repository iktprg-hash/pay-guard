import { describe, expect, it } from "vitest";
import { StripeServiceError } from "@/lib/stripe";
import {
  mapBillingSyncCodeToAppError,
  mapStripeErrorToAppError,
} from "@/lib/errors/billing";

describe("mapStripeErrorToAppError", () => {
  it("maps already_pro to STRIPE_ERROR with details", () => {
    const error = mapStripeErrorToAppError(
      new StripeServiceError("Already subscribed", "already_pro")
    );
    expect(error.code).toBe("STRIPE_ERROR");
    expect(error.details).toEqual({ stripeCode: "already_pro" });
  });

  it("maps no_customer to STRIPE_ERROR", () => {
    const error = mapStripeErrorToAppError(
      new StripeServiceError("No customer", "no_customer")
    );
    expect(error.code).toBe("STRIPE_ERROR");
  });
});

describe("mapBillingSyncCodeToAppError", () => {
  it("maps sync failures to VALIDATION_ERROR", () => {
    const error = mapBillingSyncCodeToAppError("no_active_subscription");
    expect(error.code).toBe("VALIDATION_ERROR");
  });
});
