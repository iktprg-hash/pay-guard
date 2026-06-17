import { NextResponse } from "next/server";
import { withProtection } from "@/lib/api/with-protection";
import {
  createAppError,
  respondWithError,
  respondWithValidationError,
  toApiResponse,
} from "@/lib/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { renderRecommendationPdfBuffer } from "@/lib/pdf/renderRecommendationPdf";
import { getRecommendationPdfFilename } from "@/lib/pdf/filename";
import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import { pdfRecommendationRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

/** Max JSON body size for PDF export (mirrors webhook cap pattern). */
const PDF_MAX_BODY_BYTES = 512_000;

/** Pro-only server PDF export for payment recommendations. */
export const POST = withProtection(
  async (request) => {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > PDF_MAX_BODY_BYTES) {
      return respondWithError("VALIDATION_ERROR", {
        message: "Request body too large",
      });
    }

    const parsed = await parseJsonBody(request, pdfRecommendationRequestSchema);
    if (!parsed.ok) return respondWithValidationError(parsed.error);

    try {
      const { recommendation, profile, locale } = parsed.data;
      const pdfBuffer = await renderRecommendationPdfBuffer({
        recommendation: recommendation as PrioritizationResult,
        profile: profile as FinancialProfile | undefined,
        locale,
      });

      const date = new Date().toISOString().slice(0, 10);
      const filename = getRecommendationPdfFilename(locale, date);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Content-Length": String(pdfBuffer.length),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("[api/pdf/recommendation]", error);
      return toApiResponse(
        createAppError("PDF_GENERATION_FAILED", { details: error })
      );
    }
  },
  { requirePro: true, rateLimit: { scope: "pdf", limit: 10 } }
);
