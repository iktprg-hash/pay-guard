import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/protected";
import { claimSessionForUser } from "@/lib/chat/persistence";
import { respondWithError, respondWithValidationError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { sessionClaimSchema } from "@/lib/validation/schemas";

/** Propojí anonymní chat relaci s přihlášeným uživatelem */
export const POST = withAuth(
  async (request, { user }) => {
    const parsed = await parseJsonBody(request, sessionClaimSchema);
    if (!parsed.ok) return respondWithValidationError(parsed.error);

    const ok = await claimSessionForUser(
      parsed.data.sessionId,
      parsed.data.sessionToken,
      user.id
    );

    if (!ok) {
      return respondWithError("CONFLICT", { message: "Session claim failed" });
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
