import { describe, expect, it } from "vitest";
import { StripeServiceError } from "@/lib/stripe";
import {
  appErrorFromBillingSyncCode,
  appErrorFromStripeService,
} from "@/lib/errors/billing";

describe("appErrorFromStripeService", () => {
  it("maps already_pro to BILLING_ALREADY_PRO", () => {
    const error = appErrorFromStripeService(
      new StripeServiceError("Already pro", "already_pro")
    );
    expect(error.code).toBe("BILLING_ALREADY_PRO");
    expect(error.statusCode).toBe(409);
  });

  it("maps no_customer to BILLING_NO_CUSTOMER", () => {
    const error = appErrorFromStripeService(
      new StripeServiceError("No customer", "no_customer")
    );
    expect(error.code).toBe("BILLING_NO_CUSTOMER");
    expect(error.statusCode).toBe(404);
  });
});

describe("appErrorFromBillingSyncCode", () => {
  it("wraps sync code in UNPROCESSABLE_ENTITY", () => {
    const error = appErrorFromBillingSyncCode("session_mismatch");
    expect(error.code).toBe("UNPROCESSABLE_ENTITY");
    expect(error.details).toEqual({ syncCode: "session_mismatch" });
  });
});
