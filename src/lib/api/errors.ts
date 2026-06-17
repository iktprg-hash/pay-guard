import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAppError, toApiResponse } from "@/lib/errors";

/** @deprecated Prefer `respondWithError` / `toApiResponse` from `@/lib/errors`. */
export function validationError(error: ZodError) {
  return toApiResponse(
    createAppError("VALIDATION_ERROR", {
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    })
  );
}

export function rateLimitError(resetAt: number) {
  return toApiResponse(
    createAppError("RATE_LIMITED", { details: { resetAt } })
  );
}

export function unauthorizedError(message = "Authentication required") {
  return toApiResponse(createAppError("UNAUTHORIZED", { message }));
}

export function badRequest(message: string) {
  return toApiResponse(createAppError("BAD_REQUEST", { message }));
}

export function serviceUnavailable(message: string) {
  return toApiResponse(createAppError("SERVICE_UNAVAILABLE", { message }));
}

export function proRequiredError() {
  return toApiResponse(createAppError("PRO_REQUIRED"));
}

export function internalServerError(message = "Internal server error") {
  return toApiResponse(createAppError("INTERNAL_ERROR", { message }));
}

/** Re-export for routes migrating off legacy helpers. */
export { toApiResponse, respondWithError, createAppError } from "@/lib/errors";
