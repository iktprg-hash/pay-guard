import { StripeServiceError } from "@/lib/stripe";
import { createAppError, type AppError } from "@/lib/errors/app-error";
import { describeBillingSyncClientError } from "@/lib/billing/sync-checkout";

export function appErrorFromStripeService(error: StripeServiceError): AppError {
  switch (error.code) {
    case "not_configured":
      return createAppError("BILLING_NOT_CONFIGURED");
    case "already_pro":
      return createAppError("BILLING_ALREADY_PRO");
    case "email_required":
      return createAppError("BILLING_EMAIL_REQUIRED");
    case "no_customer":
      return createAppError("BILLING_NO_CUSTOMER");
    default:
      return createAppError("STRIPE_ERROR", { message: error.message });
  }
}

export function appErrorFromBillingSyncCode(code: string): AppError {
  return createAppError("UNPROCESSABLE_ENTITY", {
    message: describeBillingSyncClientError(code),
    details: { syncCode: code },
  });
}
