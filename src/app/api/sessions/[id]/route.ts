import { NextResponse } from "next/server";
import { withProProtection } from "@/lib/api/protected";
import { createClient } from "@/lib/supabase/server";
import { loadUserSessionBundle } from "@/lib/chat/persistence";
import { respondWithError, respondWithValidationError } from "@/lib/errors";
import { parseQueryParams } from "@/lib/api/parse-request";
import { emptyQuerySchema, sessionIdSchema } from "@/lib/validation/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withProProtection<RouteContext>(
  async (request, { user }, routeContext) => {
    const query = parseQueryParams(request, emptyQuerySchema);
    if (!query.ok) return respondWithValidationError(query.error);

    const { id: rawId } = await routeContext.params;
    const parsedId = sessionIdSchema.safeParse(rawId);
    if (!parsedId.success) return respondWithValidationError(parsedId.error);

    const supabase = await createClient();
    const bundle = await loadUserSessionBundle(
      supabase,
      parsedId.data,
      user.id
    );

    if (!bundle) {
      return respondWithError("FORBIDDEN", { statusCode: 404 });
    }

    return NextResponse.json({ session: bundle });
  },
  { rateLimit: "sessions-read" }
);
