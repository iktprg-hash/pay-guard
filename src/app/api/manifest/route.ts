import { NextResponse } from "next/server";
import { buildManifest } from "@/lib/pwa/config";
import type { PwaLocale } from "@/lib/pwa/config";

/** Dynamický manifest podle locale (?locale=cs|ru|en) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = (searchParams.get("locale") ?? "cs") as PwaLocale;
  const safeLocale = ["cs", "ru", "en"].includes(locale) ? locale : "cs";

  return NextResponse.json(buildManifest(safeLocale as PwaLocale), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
