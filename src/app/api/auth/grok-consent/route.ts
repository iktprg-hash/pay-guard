import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  getUserGrokConsent,
  setUserGrokConsent,
} from "@/lib/auth/grok-consent";
import { rateLimitError } from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

/** GET — current Grok consent status for the authenticated user */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

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
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `grok-consent-post:${auth.user.id}:${ip}`,
    10,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const ok = await setUserGrokConsent(auth.user.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to record consent" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, consented: true });
}
