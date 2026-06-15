import { NextRequest, NextResponse } from "next/server";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";
import { assertSupabaseConfigured } from "@/lib/supabase/guard";

/** Odhlášení — vyčistí session cookies na serveru */
export async function POST(request: NextRequest) {
  const supabaseGuard = assertSupabaseConfigured();
  if (supabaseGuard) return supabaseGuard;

  const limited = await enforceAuthRateLimit(request, "logout");
  if (limited) return limited;

  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  await supabase.auth.signOut();

  return response;
}
