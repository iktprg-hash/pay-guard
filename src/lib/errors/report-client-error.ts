/** Client-side error reporting — Sentry-ready placeholder. */
export interface ClientErrorContext {
  boundary?: string;
  digest?: string;
  userId?: string;
}

export function reportClientError(
  error: Error,
  context: ClientErrorContext = {}
): void {
  const payload = {
    message: error.message,
    stack: error.stack,
    ...context,
  };

  console.error("[client-error]", payload);

  // Sentry.captureException(error, { extra: context });
}
