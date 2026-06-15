import { NextResponse } from "next/server";
import { buildManifest } from "@/lib/pwa/config";
import type { PwaLocale } from "@/lib/pwa/config";
import { validationError } from "@/lib/api/errors";
import { parseQueryParams } from "@/lib/api/parse-request";
import { manifestQuerySchema } from "@/lib/validation/schemas";

/** Dynamický manifest podle locale (?locale=cs|ru|en) */
export async function GET(request: Request) {
  const parsed = parseQueryParams(request as import("next/server").NextRequest, manifestQuerySchema);
  if (!parsed.ok) return validationError(parsed.error);

  const safeLocale = parsed.data.locale as PwaLocale;

  return NextResponse.json(buildManifest(safeLocale), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
