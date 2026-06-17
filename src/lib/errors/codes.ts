/** Application error codes returned in API responses and thrown as {@link AppError}. */
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PRO_REQUIRED"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "CHAT_PROCESSING_FAILED"
  | "PRIORITIZATION_FAILED"
  | "PDF_GENERATION_FAILED"
  | "STRIPE_ERROR"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";

/** Runtime guard for parsing API error codes. */
export function isErrorCode(value: string): value is ErrorCode {
  return (
    value === "UNAUTHORIZED" ||
    value === "FORBIDDEN" ||
    value === "PRO_REQUIRED" ||
    value === "RATE_LIMITED" ||
    value === "VALIDATION_ERROR" ||
    value === "CHAT_PROCESSING_FAILED" ||
    value === "PRIORITIZATION_FAILED" ||
    value === "PDF_GENERATION_FAILED" ||
    value === "STRIPE_ERROR" ||
    value === "NETWORK_ERROR" ||
    value === "INTERNAL_ERROR" ||
    value === "UNKNOWN_ERROR"
  );
}
