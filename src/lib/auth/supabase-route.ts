import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

/** Supabase client pro auth route — cookies se zapisují do response */
export function createSessionRouteClient(
  request: NextRequest,
  response: NextResponse
) {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
