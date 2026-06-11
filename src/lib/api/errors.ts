import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function validationError(error: ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      details: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 400 }
  );
}

export function rateLimitError(resetAt: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    }
  );
}

export function unauthorizedError(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function serviceUnavailable(message: string) {
  return NextResponse.json({ error: message }, { status: 503 });
}
