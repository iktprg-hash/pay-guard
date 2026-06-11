import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function stripQuotes(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function isSupabaseConfigured(): boolean {
  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return Boolean(url && key && !url.includes("your-project"));
}

/** Obnoví Supabase auth session v proxy (Next.js 16) */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    console.error(
      "[proxy] Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel"
    );
    return { supabaseResponse, user: null };
  }

  try {
    const supabase = createServerClient(
      stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL)!,
      stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { supabaseResponse, user: user ?? null };
  } catch (error) {
    console.error("[proxy] updateSession failed:", error);
    return { supabaseResponse, user: null };
  }
}

/** Zkopíruje cookies z jedné odpovědi do druhé (session + i18n) */
export function mergeResponseCookies(
  source: NextResponse,
  target: NextResponse
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });
  return target;
}
