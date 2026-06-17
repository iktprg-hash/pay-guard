import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./app-error";
import type { ErrorCode } from "./codes";
import { getUserErrorMessage } from "./user-messages";
import type { Locale } from "@/i18n/routing";

/** Standard JSON body for API error responses. */
export interface ApiErrorBody {
  error: ErrorCode;
  message: string;
}

export interface CreateAppErrorOptions {
  message?: string;
  statusCode?: number;
  details?: unknown;
}

export interface ApiErrorOptions {
  locale?: Locale;
}

export interface RespondWithErrorOptions extends CreateAppErrorOptions {
  locale?: Locale;
}

/** Default HTTP status for each {@link ErrorCode}. */
function getDefaultStatusCode(code: ErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "PRO_REQUIRED":
      return 403;
    case "RATE_LIMITED":
      return 429;
    case "VALIDATION_ERROR":
      return 400;
    default:
      return 500;
  }
}

/** Factory for typed application errors. */
export function createAppError(
  code: ErrorCode,
  options?: CreateAppErrorOptions
): AppError {
  const statusCode = options?.statusCode ?? getDefaultStatusCode(code);
  const message = options?.message ?? code;
  return new AppError(code, message, statusCode, options?.details);
}

/** Coerce unknown thrown values into {@link AppError}. */
function normalizeToAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return createAppError("VALIDATION_ERROR", { details: error.issues });
  }

  if (error instanceof Error) {
    return createAppError("INTERNAL_ERROR", {
      message: error.message,
      details: error,
    });
  }

  return createAppError("INTERNAL_ERROR", { details: error });
}

/** Serialize any error to `{ error, message }` JSON with the correct HTTP status. */
export function toApiResponse(
  error: unknown,
  options?: ApiErrorOptions
): NextResponse<ApiErrorBody> {
  const locale = options?.locale ?? "cs";
  const appError = normalizeToAppError(error);

  if (!(error instanceof AppError) && !(error instanceof ZodError)) {
    console.error("Unhandled error:", error);
  }

  return NextResponse.json(
    {
      error: appError.code,
      message: getUserErrorMessage(appError.code, locale),
    } satisfies ApiErrorBody,
    { status: appError.statusCode }
  );
}

/** Universal catch-block handler for API routes. */
export function handleApiError(
  error: unknown,
  options?: ApiErrorOptions
): NextResponse<ApiErrorBody> {
  return toApiResponse(error, options);
}

/** User-facing message from {@link AppError} or unknown failure (client-safe). */
export function getUserErrorMessageFromError(
  error: unknown,
  locale: Locale = "cs"
): string {
  if (error instanceof AppError) {
    return getUserErrorMessage(error.code, locale);
  }
  if (error instanceof Error && error.message === "OFFLINE") {
    return getUserErrorMessage("NETWORK_ERROR", locale);
  }
  return getUserErrorMessage("UNKNOWN_ERROR", locale);
}

/** Type guard for {@link AppError}. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Shorthand for routes — returns a typed error {@link NextResponse}. */
export function respondWithError(
  code: ErrorCode,
  options?: RespondWithErrorOptions
): NextResponse<ApiErrorBody> {
  const { locale, ...errorOptions } = options ?? {};
  return toApiResponse(createAppError(code, errorOptions), { locale });
}

/** Zod validation failure → 400 `VALIDATION_ERROR`. */
export function respondWithValidationError(
  error: ZodError,
  options?: ApiErrorOptions
): NextResponse<ApiErrorBody> {
  return toApiResponse(createAppError("VALIDATION_ERROR", { details: error.issues }), options);
}
