"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { downloadRecommendationPdf } from "@/lib/export/downloadRecommendationPdf";
import { downloadPriorityReport } from "@/lib/export/pdfReport";
import { toast } from "@/components/ui/toast-provider";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import type {
  FinancialProfile,
  PrioritizationResult,
  UserFinancialProfile,
} from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

export interface RecommendationPdfInput {
  recommendation: PrioritizationResult;
  profile?: FinancialProfile | UserFinancialProfile;
  locale: Locale;
}

/** Pro → server PDF; Free → legacy client jsPDF fallback where allowed. */
export function useRecommendationPdfDownload() {
  const t = useTranslations("recommendation");
  const { pro } = useSubscriptionTier();
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadPdf = useCallback(
    async (input: RecommendationPdfInput, { allowFreeFallback = false } = {}) => {
      if (!pro && !allowFreeFallback) {
        toast(t("pdfProOnly"), "error");
        return false;
      }

      setIsGenerating(true);
      try {
        if (pro) {
          await downloadRecommendationPdf(input);
        } else {
          await downloadPriorityReport(input.recommendation, input.locale);
        }
        toast(t("pdfSuccess"), "success");
        return true;
      } catch (error) {
        console.error("[pdf] download failed", error);
        toast(t("pdfFailed"), "error");
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [pro, t]
  );

  return { downloadPdf, isGenerating, isPro: pro };
}
