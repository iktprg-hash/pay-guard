import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Locale } from "@/i18n/routing";
import {
  createAppError,
  AppErrorImpl,
  type AppError,
  type CreateAppErrorOptions,
} from "@/lib/errors/app-error";
import {
  getErrorDefinition,
  isAppErrorCode,
  type AppErrorCode,
} from "@/lib/errors/codes";
import { getLocalizedErrorMessage } from "@/lib/errors/messages";

export interface ApiErrorBody {
  error: string;
  code: AppErrorCode;
  userMessage?: string;
  details?: unknown;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppErrorImpl;
}

/** User-facing message with locale fallback. */
export function getUserFriendlyMessage(
  error: AppError | AppErrorCode,
  locale: Locale = "cs"
): string {
  const appError = typeof error === "string" ? createAppError(error) : error;
  return (
    appError.userMessage ??
    getLocalizedErrorMessage(appError.code, locale)
  );
}

function rateLimitResetAt(details: unknown): number | undefined {
  if (
    typeof details === "object" &&
    details !== null &&
    "resetAt" in details &&
    typeof (details as { resetAt: unknown }).resetAt === "number"
  ) {
    return (details as { resetAt: number }).resetAt;
  }
  return undefined;
}

/** Serialize AppError (or unknown) to a JSON NextResponse. */
export function toApiResponse(
  error: unknown,
  options?: { locale?: Locale }
): NextResponse<ApiErrorBody> {
  const appError = normalizeToAppError(error);
  const locale = options?.locale ?? "cs";

  const body: ApiErrorBody = {
    error: appError.message,
    code: appError.code,
    userMessage: appError.userMessage ?? getUserFriendlyMessage(appError, locale),
  };

  if (appError.details !== undefined) {
    body.details = appError.details;
  }

  const headers: HeadersInit = {};
  if (appError.code === "RATE_LIMITED") {
    const resetAt = rateLimitResetAt(appError.details);
    if (resetAt !== undefined) {
      headers["Retry-After"] = String(
        Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
      );
    }
  }

  return NextResponse.json(body, {
    status: appError.statusCode,
    headers,
  });
}

/** Coerce unknown thrown values into AppError. */
export function normalizeToAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof ZodError) {
    return createAppError("VALIDATION_ERROR", {
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof Error) {
    return createAppError("INTERNAL_ERROR", {
      message: error.message,
      cause: error,
    });
  }

  return createAppError("INTERNAL_ERROR", {
    details: error,
  });
}

function statusToFallbackCode(status: number): AppErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 429:
      return "RATE_LIMITED";
    case 502:
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST";
  }
}

/** Parse API error JSON from a failed fetch Response (client-safe). */
export async function appErrorFromResponse(
  response: Response,
  locale: Locale = "cs"
): Promise<AppError> {
  let body: Partial<ApiErrorBody> | null = null;

  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    body = null;
  }

  const code =
    body?.code && isAppErrorCode(body.code)
      ? body.code
      : statusToFallbackCode(response.status);

  const definition = getErrorDefinition(code);

  return createAppError(code, {
    message: body?.error ?? definition.message,
    userMessage:
      body?.userMessage ?? getLocalizedErrorMessage(code, locale),
    statusCode: response.status || definition.statusCode,
    details: body?.details,
  });
}

/** Shorthand for routes: throw-style helper that returns NextResponse. */
export function respondWithError(
  code: AppErrorCode,
  options?: CreateAppErrorOptions
): NextResponse<ApiErrorBody> {
  return toApiResponse(createAppError(code, options));
}

/** Zod validation issues for API error details. */
export function formatZodValidationDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/** Validation failed — 400 with issue details. */
export function respondWithValidationError(
  error: ZodError
): NextResponse<ApiErrorBody> {
  return respondWithError("VALIDATION_ERROR", {
    details: formatZodValidationDetails(error),
  });
}

export { createAppError };
