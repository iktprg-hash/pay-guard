import { NextResponse } from "next/server";
import { buildManifest } from "@/lib/pwa/config";
import { routing } from "@/i18n/routing";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  const safeLocale = routing.locales.includes(locale as "cs" | "ru" | "en")
    ? (locale as "cs" | "ru" | "en")
    : "cs";

  return NextResponse.json(buildManifest(safeLocale), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
