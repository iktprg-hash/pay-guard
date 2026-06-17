import * as Sentry from "@sentry/nextjs";
import { AppError } from "@/lib/errors/app-error";
import type { ErrorCode } from "@/lib/errors/codes";

/**
 * Errors reported to Sentry — unexpected failures worth investigating.
 * Excluded: UNAUTHORIZED, FORBIDDEN, PRO_REQUIRED, RATE_LIMITED,
 * VALIDATION_ERROR, NETWORK_ERROR (expected user/client conditions).
 */
export const SENTRY_REPORTABLE_ERROR_CODES = [
  "INTERNAL_ERROR",
  "UNKNOWN_ERROR",
  "CHAT_PROCESSING_FAILED",
  "PRIORITIZATION_FAILED",
  "PDF_GENERATION_FAILED",
  "STRIPE_ERROR",
] as const satisfies readonly ErrorCode[];

export type SentryReportableErrorCode = (typeof SENTRY_REPORTABLE_ERROR_CODES)[number];

export interface SentryErrorContext extends Record<string, unknown> {
  errorCode?: ErrorCode;
  locale?: string;
  userId?: string;
  statusCode?: number;
}

export function shouldReportErrorToSentry(code: ErrorCode): code is SentryReportableErrorCode {
  return (SENTRY_REPORTABLE_ERROR_CODES as readonly ErrorCode[]).includes(code);
}

function isSentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/** Best-effort Sentry reporting — never throws. */
export function captureErrorToSentry(
  error: AppError | Error,
  context: SentryErrorContext = {}
): void {
  const code =
    context.errorCode ?? (error instanceof AppError ? error.code : undefined);

  if (code && !shouldReportErrorToSentry(code)) {
    return;
  }

  if (!isSentryConfigured()) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      if (code) scope.setTag("error.code", code);
      if (context.locale) scope.setTag("locale", context.locale);
      if (context.statusCode !== undefined) {
        scope.setTag("http.status_code", String(context.statusCode));
      }
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }

      scope.setContext("app_error", {
        code: error instanceof AppError ? error.code : code,
        statusCode: error instanceof AppError ? error.statusCode : context.statusCode,
        details: error instanceof AppError ? error.details : undefined,
        ...context,
      });

      Sentry.captureException(error);
    });
  } catch {
    // Optional integration — must not break API responses.
  }
}
