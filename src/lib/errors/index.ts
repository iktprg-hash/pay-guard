export type { AppError, CreateAppErrorOptions } from "@/lib/errors/app-error";
export { createAppError, AppErrorImpl } from "@/lib/errors/app-error";
export type { AppErrorCode, ErrorDefinition } from "@/lib/errors/codes";
export {
  ERROR_DEFINITIONS,
  getErrorDefinition,
  isAppErrorCode,
} from "@/lib/errors/codes";
export { getLocalizedErrorMessage } from "@/lib/errors/messages";
export {
  errorMessages,
  getUserErrorMessage,
  getUserErrorMessageFromError,
  resolveUserErrorCode,
  type ClientErrorCode,
  type UserErrorCode,
} from "@/lib/errors/user-messages";
export {
  appErrorFromBillingSyncCode,
  appErrorFromStripeService,
} from "@/lib/errors/billing";
export type { ApiErrorBody } from "@/lib/errors/utils";
export {
  appErrorFromResponse,
  formatZodValidationDetails,
  getUserFriendlyMessage,
  isAppError,
  normalizeToAppError,
  respondWithError,
  respondWithValidationError,
  toApiResponse,
} from "@/lib/errors/utils";
