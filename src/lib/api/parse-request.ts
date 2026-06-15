import type { NextRequest } from "next/server";
import type { z, ZodError } from "zod";

/** Parse JSON request body with a Zod schema (null body → validation error). */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<
  | { ok: true; data: z.infer<T> }
  | { ok: false; error: ZodError }
> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, data: parsed.data };
}

/** Parse URL search params as a plain object with a Zod schema. */
export function parseQueryParams<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): { ok: true; data: z.infer<T> } | { ok: false; error: ZodError } {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, data: parsed.data };
}
