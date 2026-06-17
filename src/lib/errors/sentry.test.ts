import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const sentryMocks = vi.hoisted(() => {
  const captureException = vi.fn();
  const setTag = vi.fn();
  const setUser = vi.fn();
  const setContext = vi.fn();
  const withScope = vi.fn((callback: (scope: unknown) => void) => {
    callback({ setTag, setUser, setContext });
  });

  return { captureException, setTag, setUser, setContext, withScope };
});

vi.mock("@sentry/nextjs", () => ({
  withScope: sentryMocks.withScope,
  captureException: sentryMocks.captureException,
}));

import {
  captureErrorToSentry,
  shouldReportErrorToSentry,
} from "@/lib/errors/sentry";

describe("shouldReportErrorToSentry", () => {
  it("reports serious server errors", () => {
    expect(shouldReportErrorToSentry("INTERNAL_ERROR")).toBe(true);
    expect(shouldReportErrorToSentry("CHAT_PROCESSING_FAILED")).toBe(true);
    expect(shouldReportErrorToSentry("PDF_GENERATION_FAILED")).toBe(true);
    expect(shouldReportErrorToSentry("STRIPE_ERROR")).toBe(true);
  });

  it("skips expected client/auth errors", () => {
    expect(shouldReportErrorToSentry("UNAUTHORIZED")).toBe(false);
    expect(shouldReportErrorToSentry("PRO_REQUIRED")).toBe(false);
    expect(shouldReportErrorToSentry("RATE_LIMITED")).toBe(false);
    expect(shouldReportErrorToSentry("VALIDATION_ERROR")).toBe(false);
    expect(shouldReportErrorToSentry("NETWORK_ERROR")).toBe(false);
  });
});

describe("captureErrorToSentry", () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENTRY_DSN = "https://example@sentry.io/1";
  });

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn;
  });

  it("captures reportable AppError with context", () => {
    const error = new AppError("PDF_GENERATION_FAILED", "pdf failed", 500);

    captureErrorToSentry(error, {
      locale: "cs",
      userId: "user-123",
    });

    expect(sentryMocks.withScope).toHaveBeenCalled();
    expect(sentryMocks.setTag).toHaveBeenCalledWith(
      "error.code",
      "PDF_GENERATION_FAILED"
    );
    expect(sentryMocks.setTag).toHaveBeenCalledWith("locale", "cs");
    expect(sentryMocks.setUser).toHaveBeenCalledWith({ id: "user-123" });
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
  });

  it("does not capture PRO_REQUIRED", () => {
    captureErrorToSentry(new AppError("PRO_REQUIRED", "pro", 403));
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("no-ops when Sentry DSN is missing", () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    captureErrorToSentry(new AppError("INTERNAL_ERROR", "boom", 500));
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });
});
