import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { claimSessionForUser } from "@/lib/chat/persistence";
import { validationError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { sessionClaimSchema } from "@/lib/validation/schemas";

/** Propojí anonymní chat relaci s přihlášeným uživatelem */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const limited = await enforceAuthRateLimit(
    request,
    "session-claim",
    auth.user.id
  );
  if (limited) return limited;

  const parsed = await parseJsonBody(request, sessionClaimSchema);
  if (!parsed.ok) return validationError(parsed.error);

  const ok = await claimSessionForUser(
    parsed.data.sessionId,
    parsed.data.sessionToken,
    auth.user.id
  );

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Session claim failed" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
