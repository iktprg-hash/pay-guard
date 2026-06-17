import { StripeServiceError } from "@/lib/stripe";
import { describeBillingSyncClientError } from "@/lib/billing/sync-checkout";
import { createAppError } from "@/lib/errors/utils";
import type { AppError } from "@/lib/errors/app-error";

/** Maps Stripe service failures to typed {@link AppError} instances. */
export function mapStripeErrorToAppError(error: StripeServiceError): AppError {
  switch (error.code) {
    case "not_configured":
      return createAppError("STRIPE_ERROR", { statusCode: 503 });
    case "already_pro":
      return createAppError("STRIPE_ERROR", {
        message: error.message,
        details: { stripeCode: "already_pro" },
      });
    case "email_required":
      return createAppError("VALIDATION_ERROR", { message: error.message });
    case "no_customer":
      return createAppError("STRIPE_ERROR", { message: error.message });
    default:
      return createAppError("STRIPE_ERROR", { message: error.message });
  }
}

/** Maps billing sync result codes to validation errors for the client. */
export function mapBillingSyncCodeToAppError(code: string): AppError {
  return createAppError("VALIDATION_ERROR", {
    message: describeBillingSyncClientError(code),
    details: { syncCode: code },
  });
}

/** @deprecated Use {@link mapStripeErrorToAppError}. */
export const appErrorFromStripeService = mapStripeErrorToAppError;

/** @deprecated Use {@link mapBillingSyncCodeToAppError}. */
export const appErrorFromBillingSyncCode = mapBillingSyncCodeToAppError;
