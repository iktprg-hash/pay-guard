import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { syncUserProfileLocale } from "@/lib/auth/profile";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import type { Locale } from "@/i18n/routing";

const bodySchema = z.object({
  locale: z.enum(["cs", "ru", "en"]),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `sync-profile:${auth.user.id}:${ip}`,
    20,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  await syncUserProfileLocale(auth.user.id, parsed.data.locale as Locale);
  return NextResponse.json({ ok: true });
}
