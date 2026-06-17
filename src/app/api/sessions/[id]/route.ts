import { NextResponse } from "next/server";
import { withProProtection } from "@/lib/api/protected";
import { createClient } from "@/lib/supabase/server";
import { loadUserSessionBundle } from "@/lib/chat/persistence";
import { validationError } from "@/lib/api/errors";
import { parseQueryParams } from "@/lib/api/parse-request";
import { emptyQuerySchema, sessionIdSchema } from "@/lib/validation/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withProProtection<RouteContext>(
  async (request, { user }, routeContext) => {
    const query = parseQueryParams(request, emptyQuerySchema);
    if (!query.ok) return validationError(query.error);

    const { id: rawId } = await routeContext.params;
    const parsedId = sessionIdSchema.safeParse(rawId);
    if (!parsedId.success) return validationError(parsedId.error);

    const supabase = await createClient();
    const bundle = await loadUserSessionBundle(
      supabase,
      parsedId.data,
      user.id
    );

    if (!bundle) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ session: bundle });
  },
  { rateLimit: "sessions-read" }
);
