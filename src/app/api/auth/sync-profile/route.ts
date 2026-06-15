import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { syncUserProfileLocale } from "@/lib/auth/profile";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import type { Locale } from "@/i18n/routing";
import { authSyncProfileSchema } from "@/lib/validation/schemas";

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

  const parsed = await parseJsonBody(request, authSyncProfileSchema);
  if (!parsed.ok) return validationError(parsed.error);

  await syncUserProfileLocale(auth.user.id, parsed.data.locale as Locale);
  return NextResponse.json({ ok: true });
}
