import { NextResponse } from "next/server";
import {
  createUserSession,
  listUserSessions,
} from "@/lib/chat/persistence";
import { withProProtection } from "@/lib/api/protected";
import { createClient } from "@/lib/supabase/server";
import {
  createAppError,
  respondWithValidationError,
  toApiResponse,
} from "@/lib/errors";
import { parseJsonBody, parseQueryParams } from "@/lib/api/parse-request";
import {
  emptyQuerySchema,
  sessionCreateSchema,
} from "@/lib/validation/schemas";

/** GET — seznam konzultací uživatele */
export const GET = withProProtection(
  async (request, { user }) => {
    const query = parseQueryParams(request, emptyQuerySchema);
    if (!query.ok) return respondWithValidationError(query.error);

    const supabase = await createClient();
    const sessions = await listUserSessions(supabase, user.id);
    return NextResponse.json({ sessions });
  },
  { rateLimit: "sessions-read" }
);

/** POST — vytvoří novou finanční relaci */
export const POST = withProProtection(
  async (request, { user }) => {
    try {
      const parsed = await parseJsonBody(request, sessionCreateSchema);
      if (!parsed.ok) return respondWithValidationError(parsed.error);

      const supabase = await createClient();
      const created = await createUserSession(
        supabase,
        user.id,
        parsed.data.locale
      );
      if (!created) {
        return toApiResponse(
          createAppError("INTERNAL_ERROR", {
            message: "Could not create session",
          })
        );
      }

      return NextResponse.json(created);
    } catch (error) {
      console.error("[api/sessions POST]", error);
      return toApiResponse(
        createAppError("INTERNAL_ERROR", { message: "Server error", details: error })
      );
    }
  },
  { rateLimit: "sessions-write" }
);
