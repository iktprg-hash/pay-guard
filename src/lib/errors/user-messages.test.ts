import { describe, expect, it } from "vitest";
import { createAppError } from "@/lib/errors/app-error";
import {
  errorMessages,
  getUserErrorMessage,
  getUserErrorMessageFromError,
  resolveUserErrorCode,
} from "@/lib/errors/user-messages";

describe("getUserErrorMessage", () => {
  it("returns empathetic Czech message for RATE_LIMITED", () => {
    const message = getUserErrorMessage("RATE_LIMITED", "cs");
    expect(message).toContain("příliš mnoho");
    expect(message).not.toContain("Rate limit");
  });

  it("returns empathetic Russian message for RATE_LIMITED", () => {
    const message = getUserErrorMessage("RATE_LIMITED", "ru");
    expect(message).toContain("Слишком много запросов");
  });

  it("returns empathetic English message for PRO_REQUIRED", () => {
    const message = getUserErrorMessage("PRO_REQUIRED", "en");
    expect(message).toContain("Pay Guard Pro");
  });

  it("covers required error codes in all locales", () => {
    const required = [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "PRO_REQUIRED",
      "RATE_LIMITED",
      "VALIDATION_ERROR",
      "CHAT_PROCESSING_FAILED",
      "PRIORITIZATION_FAILED",
      "PDF_GENERATION_FAILED",
      "STRIPE_ERROR",
      "NETWORK_ERROR",
      "INTERNAL_ERROR",
      "UNKNOWN_ERROR",
    ] as const;

    for (const locale of ["cs", "ru", "en"] as const) {
      for (const code of required) {
        expect(errorMessages[locale][code].length).toBeGreaterThan(10);
      }
    }
  });
});

describe("getUserErrorMessageFromError", () => {
  it("prefers AppError userMessage override", () => {
    const error = createAppError("INTERNAL_ERROR", {
      userMessage: "Custom override",
    });
    expect(getUserErrorMessageFromError(error, "cs")).toBe("Custom override");
  });

  it("maps offline failures to NETWORK_ERROR", () => {
    expect(resolveUserErrorCode(new Error("OFFLINE"))).toBe("NETWORK_ERROR");
    expect(getUserErrorMessageFromError(new Error("OFFLINE"), "ru")).toContain(
      "интернета"
    );
  });

  it("falls back to UNKNOWN_ERROR", () => {
    expect(getUserErrorMessageFromError({ weird: true }, "en")).toContain(
      "unexpected"
    );
  });
});
