import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

/** Supabase klient pro Server Components a Route Handlers */
export async function createClient() {
  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !key || url.includes("your-project")) {
    throw new Error("Supabase is not configured");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll může selhat v Server Component — ignorujeme
        }
      },
    },
  });
}
