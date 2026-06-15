import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createUserSession,
  listUserSessions,
} from "@/lib/chat/persistence";
import { requireProApiWithRateLimit } from "@/lib/api/pro-route-guard";
import { createClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/api/errors";
import { parseJsonBody, parseQueryParams } from "@/lib/api/parse-request";
import {
  emptyQuerySchema,
  sessionCreateSchema,
} from "@/lib/validation/schemas";

/** GET — seznam konzultací uživatele */
export async function GET(request: NextRequest) {
  const guard = await requireProApiWithRateLimit(request, "sessions-read");
  if (!guard.ok) return guard.response;

  const query = parseQueryParams(request, emptyQuerySchema);
  if (!query.ok) return validationError(query.error);

  const supabase = await createClient();
  const sessions = await listUserSessions(supabase, guard.user.id);
  return NextResponse.json({ sessions });
}

/** POST — vytvoří novou finanční relaci */
export async function POST(request: NextRequest) {
  const guard = await requireProApiWithRateLimit(request, "sessions-write");
  if (!guard.ok) return guard.response;

  try {
    const parsed = await parseJsonBody(request, sessionCreateSchema);
    if (!parsed.ok) return validationError(parsed.error);

    const supabase = await createClient();
    const created = await createUserSession(
      supabase,
      guard.user.id,
      parsed.data.locale
    );
    if (!created) {
      return NextResponse.json(
        { error: "Could not create session" },
        { status: 500 }
      );
    }

    return NextResponse.json(created);
  } catch (error) {
    console.error("[api/sessions POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
