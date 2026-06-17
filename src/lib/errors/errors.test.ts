import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import {
  createAppError,
  getUserErrorMessageFromError,
  handleApiError,
  isAppError,
  respondWithValidationError,
  toApiResponse,
} from "@/lib/errors";
import { getUserErrorMessage } from "@/lib/errors/user-messages";

describe("AppError", () => {
  it("works with instanceof", () => {
    const error = new AppError("UNAUTHORIZED", "auth required", 401);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.statusCode).toBe(401);
  });
});

describe("createAppError", () => {
  it("applies default status codes", () => {
    expect(createAppError("PRO_REQUIRED").statusCode).toBe(403);
    expect(createAppError("RATE_LIMITED").statusCode).toBe(429);
  });
});

describe("toApiResponse", () => {
  it("returns error code and localized message", async () => {
    const res = toApiResponse(createAppError("PRO_REQUIRED"), { locale: "en" });
    expect(res.status).toBe(403);

    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("PRO_REQUIRED");
    expect(body.message).toContain("Pro users");
  });

  it("maps ZodError to validation response", async () => {
    const schema = z.object({ email: z.string().email() });
    let zodError: ZodError | null = null;
    try {
      schema.parse({ email: "bad" });
    } catch (error) {
      zodError = error as ZodError;
    }

    const res = toApiResponse(zodError);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("VALIDATION_ERROR");
  });
});

describe("handleApiError", () => {
  it("delegates to toApiResponse", async () => {
    const res = handleApiError(createAppError("INTERNAL_ERROR"), { locale: "cs" });
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("INTERNAL_ERROR");
  });
});

describe("getUserErrorMessageFromError", () => {
  it("maps AppError to localized copy", () => {
    const error = createAppError("RATE_LIMITED");
    expect(getUserErrorMessageFromError(error, "ru")).toContain("Слишком много");
  });

  it("maps OFFLINE to NETWORK_ERROR", () => {
    expect(getUserErrorMessageFromError(new Error("OFFLINE"), "cs")).toContain(
      "připojením"
    );
  });
});

describe("isAppError", () => {
  it("detects AppError instances", () => {
    expect(isAppError(createAppError("INTERNAL_ERROR"))).toBe(true);
    expect(isAppError(new Error("nope"))).toBe(false);
  });
});

describe("getUserErrorMessage", () => {
  it("covers all error codes in cs", () => {
    const codes = [
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

    for (const code of codes) {
      expect(getUserErrorMessage(code, "cs").length).toBeGreaterThan(5);
    }
  });
});

describe("respondWithValidationError", () => {
  it("returns validation error body", async () => {
    const schema = z.object({ id: z.string().uuid() });
    const parsed = schema.safeParse({ id: "bad" });
    if (parsed.success) throw new Error("expected failure");

    const res = respondWithValidationError(parsed.error);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("VALIDATION_ERROR");
  });
});
