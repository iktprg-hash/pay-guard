import { NextRequest, NextResponse } from "next/server";
import {
  withPublicAuthRateLimit,
  type AppRouteContext,
} from "@/lib/api/protected";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { assertSupabaseConfigured } from "@/lib/supabase/guard";

const handleLogout = withPublicAuthRateLimit("logout", async (request) => {
  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  await supabase.auth.signOut();

  return response;
});

/** Odhlášení — vyčistí session cookies na serveru */
export async function POST(request: NextRequest, context: AppRouteContext) {
  const supabaseGuard = assertSupabaseConfigured();
  if (supabaseGuard) return supabaseGuard;

  return handleLogout(request, context);
}
