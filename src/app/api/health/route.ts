import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Liveness check — no auth, no Supabase */
export async function GET() {
  return NextResponse.json({
    ok: true,
    supabase: isSupabaseConfigured(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? null,
  });
}
