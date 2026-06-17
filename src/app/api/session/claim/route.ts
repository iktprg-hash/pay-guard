import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/protected";
import { claimSessionForUser } from "@/lib/chat/persistence";
import { validationError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { sessionClaimSchema } from "@/lib/validation/schemas";

/** Propojí anonymní chat relaci s přihlášeným uživatelem */
export const POST = withAuth(
  async (request, { user }) => {
    const parsed = await parseJsonBody(request, sessionClaimSchema);
    if (!parsed.ok) return validationError(parsed.error);

    const ok = await claimSessionForUser(
      parsed.data.sessionId,
      parsed.data.sessionToken,
      user.id
    );

    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Session claim failed" },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  },
  {
    rateLimit: {
      scope: "session-claim",
      limit: 10,
      windowMs: 15 * 60_000,
    },
  }
);
