import { NextRequest, NextResponse } from "next/server";
import { requireProApiWithRateLimit } from "@/lib/api/pro-route-guard";
import { badRequest, validationError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { renderRecommendationPdfBuffer } from "@/lib/pdf/renderRecommendationPdf";
import { getRecommendationPdfFilename } from "@/lib/pdf/filename";
import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import { pdfRecommendationRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

/** Max JSON body size for PDF export (mirrors webhook cap pattern). */
const PDF_MAX_BODY_BYTES = 512_000;

/** Pro-only server PDF export for payment recommendations. */
export async function POST(request: NextRequest) {
  const guard = await requireProApiWithRateLimit(request, "pdf");
  if (!guard.ok) return guard.response;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > PDF_MAX_BODY_BYTES) {
    return badRequest("Request body too large");
  }

  const parsed = await parseJsonBody(request, pdfRecommendationRequestSchema);
  if (!parsed.ok) return validationError(parsed.error);

  try {
    const { recommendation, profile, locale } = parsed.data;
    const pdfBuffer = await renderRecommendationPdfBuffer({
      recommendation,
      profile: profile as FinancialProfile | undefined,
      locale,
    });

    const date = new Date().toISOString().slice(0, 10);
    const filename = getRecommendationPdfFilename(locale, date);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/pdf/recommendation]", error);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 }
    );
  }
}
