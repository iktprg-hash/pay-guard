import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { serviceUnavailable, validationError } from "@/lib/api/errors";
import { authErrorResponse } from "@/lib/auth/errors";
import {
  enforceAuthRateLimit,
  isSupabaseEmailRateLimit,
} from "@/lib/auth/rate-limit";
import { authConfirmUrl } from "@/lib/site/url";

const bodySchema = z.object({
  email: z.string().email().max(320),
  locale: z.enum(["cs", "ru", "en"]).optional(),
});

/** Odešle odkaz pro obnovení hesla */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  const limited = await enforceAuthRateLimit(
    request,
    "forgot-password",
    parsed.data.email
  );
  if (limited) return limited;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("your-project")) {
    return serviceUnavailable("Supabase is not configured in .env.local");
  }

  const locale = parsed.data.locale ?? "cs";
  const redirectTo = authConfirmUrl(request, locale, `/${locale}/reset-password`);

  const supabase = createClient(url, key);
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  if (error) {
    if (isSupabaseEmailRateLimit(error.message)) {
      console.error("[api/auth/forgot-password]", error.message);
      return authErrorResponse(error.message, 429, "supabase_email_rate_limited");
    }
    console.warn("[api/auth/forgot-password] opaque failure:", error.message);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
