import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { userHasProAccess } from "@/lib/auth/subscription";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { renderRecommendationPdfBuffer } from "@/lib/pdf/renderRecommendationPdf";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import { pdfRecommendationRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

/** Pro-only server PDF export for payment recommendations. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const hasPro = await userHasProAccess(auth.user.id);
  if (!hasPro) {
    return NextResponse.json(
      { error: "Pro subscription required", code: "PRO_REQUIRED" },
      { status: 403 }
    );
  }

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `pdf-recommendation:${auth.user.id}:${ip}`,
    20,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  const body = await request.json().catch(() => null);
  const parsed = pdfRecommendationRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { recommendation, profile, locale } = parsed.data;
    const pdfBuffer = await renderRecommendationPdfBuffer({
      recommendation: recommendation as PrioritizationResult,
      profile: profile as FinancialProfile | undefined,
      locale,
    });

    const date = new Date().toISOString().split("T")[0];
    const filename = `pay-guard-${date}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
