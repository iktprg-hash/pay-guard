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

export const PRO_DASHBOARD_PDF_KEY = "pro-dashboard";

export interface RecommendationPdfInput {
  recommendation: PrioritizationResult;
  profile?: FinancialProfile | UserFinancialProfile;
  locale: Locale;
}

export interface DownloadPdfOptions {
  allowFreeFallback?: boolean;
  /** Scope loading state to this id (session, dashboard, chat, …). */
  downloadKey?: string;
}

export type RecommendationPdfInputResolver = () => Promise<
  RecommendationPdfInput | null
>;

/** Pro → server PDF; Free → legacy client jsPDF fallback where allowed. */
export function useRecommendationPdfDownload() {
  const t = useTranslations("recommendation");
  const { pro } = useSubscriptionTier();
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  const isGeneratingForSession = useCallback(
    (sessionId: string) => generatingKey === sessionId,
    [generatingKey]
  );

  const downloadPdf = useCallback(
    async (
      input: RecommendationPdfInput | RecommendationPdfInputResolver,
      { allowFreeFallback = false, downloadKey = "default" }: DownloadPdfOptions = {}
    ) => {
      if (!pro && !allowFreeFallback) {
        toast(t("pdfProOnly"), "error");
        return false;
      }

      setGeneratingKey(downloadKey);
      try {
        const resolved = typeof input === "function" ? await input() : input;
        if (!resolved) return false;

        if (pro) {
          await downloadRecommendationPdf(resolved);
        } else {
          await downloadPriorityReport(resolved.recommendation, resolved.locale);
        }
        toast(t("pdfSuccess"), "success");
        return true;
      } catch (error) {
        console.error("[pdf] download failed", error);
        toast(t("pdfFailed"), "error");
        return false;
      } finally {
        setGeneratingKey(null);
      }
    },
    [pro, t]
  );

  return {
    downloadPdf,
    isGenerating: generatingKey !== null,
    isGeneratingForSession,
    isPro: pro,
  };
}
