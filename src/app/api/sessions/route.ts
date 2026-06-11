import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createUserSession,
  listUserSessions,
} from "@/lib/chat/persistence";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimitError,
  validationError,
} from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

const createSchema = z.object({
  locale: z.enum(["cs", "ru", "en"]).default("cs"),
});

/** GET — seznam konzultací uživatele */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(`sessions-list:${auth.user.id}:${ip}`, 60, 60_000);
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const supabase = await createClient();
  const sessions = await listUserSessions(supabase, auth.user.id);
  return NextResponse.json({ sessions });
}

/** POST — vytvoří novou finanční relaci */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(`sessions-create:${auth.user.id}:${ip}`, 30, 60_000);
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createClient();
    const created = await createUserSession(
      supabase,
      auth.user.id,
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
