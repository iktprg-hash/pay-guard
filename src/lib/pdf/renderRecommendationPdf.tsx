import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { RecommendationPDF } from "@/components/pdf/RecommendationPDF";
import { getPdfLabels } from "@/lib/pdf/labels";
import { ensurePdfFontsRegistered } from "@/lib/pdf/registerFonts";
import type {
  FinancialProfile,
  PrioritizationResult,
  UserFinancialProfile,
} from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

export interface RenderRecommendationPdfInput {
  recommendation: PrioritizationResult;
  profile?: FinancialProfile | UserFinancialProfile;
  locale: Locale;
}

/** Server-side PDF buffer for Pro recommendation export. */
export async function renderRecommendationPdfBuffer(
  input: RenderRecommendationPdfInput
): Promise<Buffer> {
  ensurePdfFontsRegistered();

  const labels = getPdfLabels(input.locale);
  const generatedAt = new Date().toISOString();

  const buffer = await renderToBuffer(
    <RecommendationPDF
      recommendation={input.recommendation}
      profile={input.profile}
      locale={input.locale}
      labels={labels}
      generatedAt={generatedAt}
    />
  );

  return Buffer.from(buffer);
}
