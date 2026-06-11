import { NextResponse } from "next/server";

/** Liveness check — no auth, no Supabase */
export async function GET() {
  const supabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project")
  );

  return NextResponse.json({
    ok: true,
    supabase,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? null,
  });
}
