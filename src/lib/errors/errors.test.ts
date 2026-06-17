import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import {
  createAppError,
  getUserFriendlyMessage,
  isAppError,
  normalizeToAppError,
  toApiResponse,
} from "@/lib/errors";

describe("createAppError", () => {
  it("uses catalog defaults", () => {
    const error = createAppError("UNAUTHORIZED");
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Authentication required");
  });

  it("allows overrides", () => {
    const error = createAppError("BAD_REQUEST", {
      message: "Body too large",
      details: { maxBytes: 512_000 },
    });
    expect(error.message).toBe("Body too large");
    expect(error.details).toEqual({ maxBytes: 512_000 });
  });
});

describe("isAppError", () => {
  it("detects AppError instances", () => {
    expect(isAppError(createAppError("INTERNAL_ERROR"))).toBe(true);
    expect(isAppError(new Error("nope"))).toBe(false);
  });
});

describe("toApiResponse", () => {
  it("serializes code and userMessage", async () => {
    const res = toApiResponse(createAppError("PRO_REQUIRED"), { locale: "en" });
    expect(res.status).toBe(403);

    const body = (await res.json()) as {
      code: string;
      error: string;
      userMessage: string;
    };
    expect(body.code).toBe("PRO_REQUIRED");
    expect(body.userMessage).toContain("Pro subscription");
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
    const body = (await res.json()) as { code: string; details: unknown[] };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("sets Retry-After for rate limits", () => {
    const resetAt = Date.now() + 30_000;
    const res = toApiResponse(
      createAppError("RATE_LIMITED", { details: { resetAt } })
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("getUserFriendlyMessage", () => {
  it("returns localized message by locale", () => {
    const error = createAppError("RATE_LIMITED");
    expect(getUserFriendlyMessage(error, "cs")).toContain("Příliš mnoho");
    expect(getUserFriendlyMessage(error, "ru")).toContain("Слишком много");
  });

  it("prefers explicit userMessage", () => {
    const error = createAppError("INTERNAL_ERROR", {
      userMessage: "Custom message",
    });
    expect(getUserFriendlyMessage(error, "en")).toBe("Custom message");
  });
});

describe("normalizeToAppError", () => {
  it("wraps generic Error", () => {
    const normalized = normalizeToAppError(new Error("boom"));
    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.message).toBe("boom");
  });
});
