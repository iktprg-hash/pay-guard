import { AppError } from "@/lib/errors/app-error";
import type { ErrorCode } from "@/lib/errors/codes";
import { isErrorCode } from "@/lib/errors/codes";
import { createAppError } from "@/lib/errors/utils";
import type { Locale } from "@/i18n/routing";

export type ApiFetchOptions = RequestInit & {
  locale?: Locale;
  /** Abort the request after N milliseconds (maps to NETWORK_ERROR on timeout). */
  timeoutMs?: number;
};

/** Detect offline, DNS, CORS, and other fetch-level network failures. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AppError && error.code === "NETWORK_ERROR") {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("fetch failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("load failed") ||
      msg.includes("offline") ||
      msg.includes("aborted") ||
      error.message === "OFFLINE"
    );
  }

  return false;
}

function createNetworkError(cause: unknown): AppError {
  return createAppError("NETWORK_ERROR", {
    message: "Network request failed",
    statusCode: 0,
    details: cause,
  });
}

function assertOnline(): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw createNetworkError(new Error("OFFLINE"));
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
  if (status >= 500) return "INTERNAL_ERROR";
  return "UNKNOWN_ERROR";
}

function mergeAbortSignal(
  init: RequestInit,
  timeoutMs?: number
): { signal: AbortSignal | undefined; cleanup: () => void } {
  if (!timeoutMs) {
    return { signal: init.signal ?? undefined, cleanup: () => {} };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

/**
 * fetch wrapper for Pay Guard API routes.
 * Throws {@link AppError} on HTTP errors and network failures.
 */
export async function apiFetchResponse(
  url: string,
  init: ApiFetchOptions = {}
): Promise<Response> {
  const { locale: _locale, timeoutMs, credentials = "include", ...requestInit } = init;
  void _locale;

  assertOnline();

  const { signal, cleanup } = mergeAbortSignal(requestInit, timeoutMs);

  try {
    const res = await fetch(url, { ...requestInit, credentials, signal });

    if (!res.ok) {
      const code = (await readErrorCode(res)) ?? statusToErrorCode(res.status);
      throw new AppError(code, `Request failed with status ${res.status}`, res.status);
    }

    return res;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isNetworkError(err)) throw createNetworkError(err);
    throw err;
  } finally {
    cleanup();
  }
}

/** JSON helper built on {@link apiFetchResponse}. */
export async function apiFetch<T>(
  url: string,
  init: ApiFetchOptions = {}
): Promise<T> {
  const res = await apiFetchResponse(url, init);
  return res.json() as Promise<T>;
}
