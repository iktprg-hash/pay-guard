/** HTTP status defaults and i18n keys for each application error code. */
export interface ErrorDefinition {
  statusCode: number;
  message: string;
  i18nKey: string;
}

/**
 * Central catalog of error codes. Add new entries here to extend the system.
 * i18n keys map to `errors.api.*` in locale message files.
 */
export const ERROR_DEFINITIONS = {
  UNAUTHORIZED: {
    statusCode: 401,
    message: "Authentication required",
    i18nKey: "errors.api.unauthorized",
  },
  FORBIDDEN: {
    statusCode: 403,
    message: "Forbidden",
    i18nKey: "errors.api.forbidden",
  },
  PRO_REQUIRED: {
    statusCode: 403,
    message: "Pro subscription required",
    i18nKey: "errors.api.proRequired",
  },
  RATE_LIMITED: {
    statusCode: 429,
    message: "Too many requests. Please try again later.",
    i18nKey: "errors.api.rateLimited",
  },
  VALIDATION_ERROR: {
    statusCode: 400,
    message: "Validation failed",
    i18nKey: "errors.api.validationError",
  },
  BAD_REQUEST: {
    statusCode: 400,
    message: "Bad request",
    i18nKey: "errors.api.badRequest",
  },
  NOT_FOUND: {
    statusCode: 404,
    message: "Not found",
    i18nKey: "errors.api.notFound",
  },
  CONFLICT: {
    statusCode: 409,
    message: "Conflict",
    i18nKey: "errors.api.conflict",
  },
  UNPROCESSABLE_ENTITY: {
    statusCode: 422,
    message: "Unprocessable entity",
    i18nKey: "errors.api.unprocessableEntity",
  },
  CHAT_CONSENT_REQUIRED: {
    statusCode: 401,
    message: "Grok data processing consent required",
    i18nKey: "errors.api.chatConsentRequired",
  },
  CHAT_PROCESSING_FAILED: {
    statusCode: 500,
    message: "Chat request failed",
    i18nKey: "errors.api.chatProcessingFailed",
  },
  CHAT_SERVICE_UNAVAILABLE: {
    statusCode: 503,
    message: "Chat service is not configured",
    i18nKey: "errors.api.chatServiceUnavailable",
  },
  CHAT_UPSTREAM_ERROR: {
    statusCode: 502,
    message: "Chat upstream request failed",
    i18nKey: "errors.api.chatUpstreamError",
  },
  PRIORITIZATION_INSUFFICIENT_DATA: {
    statusCode: 422,
    message:
      "Insufficient data for prioritization — need availableFunds > 0 and at least one debt with creditor and amount.",
    i18nKey: "errors.api.prioritizationInsufficientData",
  },
  PRIORITIZATION_FAILED: {
    statusCode: 500,
    message: "Prioritization failed",
    i18nKey: "errors.api.prioritizationFailed",
  },
  PDF_GENERATION_FAILED: {
    statusCode: 500,
    message: "PDF generation failed",
    i18nKey: "errors.api.pdfGenerationFailed",
  },
  STRIPE_ERROR: {
    statusCode: 500,
    message: "Payment processing failed",
    i18nKey: "errors.api.stripeError",
  },
  BILLING_NOT_CONFIGURED: {
    statusCode: 503,
    message: "Billing is not configured",
    i18nKey: "errors.api.billingNotConfigured",
  },
  BILLING_ALREADY_PRO: {
    statusCode: 409,
    message: "You already have an active Pro subscription.",
    i18nKey: "errors.api.billingAlreadyPro",
  },
  BILLING_EMAIL_REQUIRED: {
    statusCode: 422,
    message: "An email address is required to start a subscription.",
    i18nKey: "errors.api.billingEmailRequired",
  },
  BILLING_NO_CUSTOMER: {
    statusCode: 404,
    message: "No billing account found. Please complete a purchase first.",
    i18nKey: "errors.api.billingNoCustomer",
  },
  BILLING_CHECKOUT_FAILED: {
    statusCode: 500,
    message: "Checkout failed",
    i18nKey: "errors.api.billingCheckoutFailed",
  },
  BILLING_SYNC_FAILED: {
    statusCode: 500,
    message: "Sync failed",
    i18nKey: "errors.api.billingSyncFailed",
  },
  BILLING_CONFIRM_FAILED: {
    statusCode: 500,
    message: "Confirm failed",
    i18nKey: "errors.api.billingConfirmFailed",
  },
  SERVICE_UNAVAILABLE: {
    statusCode: 503,
    message: "Service unavailable",
    i18nKey: "errors.api.serviceUnavailable",
  },
  INTERNAL_ERROR: {
    statusCode: 500,
    message: "Internal server error",
    i18nKey: "errors.api.internalError",
  },
} as const satisfies Record<string, ErrorDefinition>;

export type AppErrorCode = keyof typeof ERROR_DEFINITIONS;

export function isAppErrorCode(value: string): value is AppErrorCode {
  return value in ERROR_DEFINITIONS;
}

export function getErrorDefinition(code: AppErrorCode): ErrorDefinition {
  return ERROR_DEFINITIONS[code];
}
