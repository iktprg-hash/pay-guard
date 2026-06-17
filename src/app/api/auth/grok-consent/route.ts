import { NextResponse } from "next/server";
import {
  getUserGrokConsent,
  setUserGrokConsent,
} from "@/lib/auth/grok-consent";
import { withAuth } from "@/lib/api/protected";
import { respondWithError, respondWithValidationError } from "@/lib/errors";
import { parseJsonBody, parseQueryParams } from "@/lib/api/parse-request";
import {
  emptyQuerySchema,
  grokConsentPostSchema,
} from "@/lib/validation/schemas";

/** GET — current Grok consent status for the authenticated user */
export const GET = withAuth(
  async (request, { user }) => {
    const query = parseQueryParams(request, emptyQuerySchema);
    if (!query.ok) return respondWithValidationError(query.error);

    const consented = await getUserGrokConsent(user.id);
    return NextResponse.json({ consented });
  },
  { rateLimit: { scope: "grok-consent-get", limit: 60 } }
);

/** POST — record Grok data-processing consent */
export const POST = withAuth(
  async (request, { user }) => {
    const parsed = await parseJsonBody(request, grokConsentPostSchema);
    if (!parsed.ok) return respondWithValidationError(parsed.error);

    const ok = await setUserGrokConsent(user.id);
    if (!ok) {
      return respondWithError("INTERNAL_ERROR", {
        message: "Failed to record consent",
      });
    }

    return NextResponse.json({ ok: true, consented: true });
  },
  { rateLimit: { scope: "grok-consent-post", limit: 10 } }
);
