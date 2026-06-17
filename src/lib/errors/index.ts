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
  appErrorFromBillingSyncCode,
  appErrorFromStripeService,
} from "@/lib/errors/billing";
export type { ApiErrorBody } from "@/lib/errors/utils";
export {
  appErrorFromResponse,
  getUserFriendlyMessage,
  isAppError,
  normalizeToAppError,
  respondWithError,
  toApiResponse,
} from "@/lib/errors/utils";
