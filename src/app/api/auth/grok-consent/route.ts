import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  getUserGrokConsent,
  setUserGrokConsent,
} from "@/lib/auth/grok-consent";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { parseJsonBody, parseQueryParams } from "@/lib/api/parse-request";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import {
  emptyQuerySchema,
  grokConsentPostSchema,
} from "@/lib/validation/schemas";

/** GET — current Grok consent status for the authenticated user */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const query = parseQueryParams(request, emptyQuerySchema);
  if (!query.ok) return validationError(query.error);

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `grok-consent-get:${auth.user.id}:${ip}`,
    60,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const consented = await getUserGrokConsent(auth.user.id);
  return NextResponse.json({ consented });
}

/** POST — record Grok data-processing consent */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `grok-consent-post:${auth.user.id}:${ip}`,
    10,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const parsed = await parseJsonBody(request, grokConsentPostSchema);
  if (!parsed.ok) return validationError(parsed.error);

  const ok = await setUserGrokConsent(auth.user.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to record consent" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, consented: true });
}
