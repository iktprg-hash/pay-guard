import { AppError } from "@/lib/errors/app-error";
import type { ErrorCode } from "@/lib/errors/codes";
import { isErrorCode } from "@/lib/errors/codes";
import type { Locale } from "@/i18n/routing";

export type ApiFetchOptions = RequestInit & {
  locale?: Locale;
};

function assertOnline(): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new AppError("NETWORK_ERROR", "OFFLINE", 0);
  }
}

/** Parses API error code from a failed response body. */
async function readErrorCode(response: Response): Promise<ErrorCode | undefined> {
  try {
    const body = (await response.clone().json()) as { error?: string };
    if (body.error && isErrorCode(body.error)) return body.error;
  } catch {
    // Non-JSON error bodies fall back to HTTP status mapping.
  }
  return undefined;
}

function statusToErrorCode(status: number): ErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  if (status === 400) return "VALIDATION_ERROR";
  return "INTERNAL_ERROR";
}

/**
 * fetch wrapper for Pay Guard API routes.
 * Throws {@link AppError} when the response is not OK.
 */
export async function apiFetchResponse(
  url: string,
  init: ApiFetchOptions = {}
): Promise<Response> {
  const { locale: _locale, credentials = "include", ...requestInit } = init;
  void _locale;

  assertOnline();

  const res = await fetch(url, { credentials, ...requestInit });

  if (!res.ok) {
    const code = (await readErrorCode(res)) ?? statusToErrorCode(res.status);
    throw new AppError(code, `Request failed with status ${res.status}`, res.status);
  }

  return res;
}

/** JSON helper built on {@link apiFetchResponse}. */
export async function apiFetch<T>(
  url: string,
  init: ApiFetchOptions = {}
): Promise<T> {
  const res = await apiFetchResponse(url, init);
  return res.json() as Promise<T>;
}
