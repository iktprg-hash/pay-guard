import { NextResponse } from "next/server";
import { syncUserProfileLocale } from "@/lib/auth/profile";
import { withAuth } from "@/lib/api/protected";
import { validationError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import type { Locale } from "@/i18n/routing";
import { authSyncProfileSchema } from "@/lib/validation/schemas";

export const POST = withAuth(
  async (request, { user }) => {
    const parsed = await parseJsonBody(request, authSyncProfileSchema);
    if (!parsed.ok) return validationError(parsed.error);

    await syncUserProfileLocale(user.id, parsed.data.locale as Locale);
    return NextResponse.json({ ok: true });
  },
  { rateLimit: { scope: "sync-profile", limit: 20 } }
);
