"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  downloadRecommendationPdf,
  isPdfProRequiredError,
} from "@/lib/export/downloadRecommendationPdf";
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
  const locale = useLocale() as Locale;
  const { pro } = useSubscriptionTier();
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  const isAnyPdfGenerating = generatingKey !== null;

  const isGeneratingForKey = useCallback(
    (key: string) => generatingKey === key,
    [generatingKey]
  );

  const showProRequiredToast = useCallback(() => {
    toast(t("pdfProOnly"), "error", {
      label: t("pdfGoPro"),
      href: `/${locale}/pricing`,
    });
  }, [locale, t]);

  const downloadPdf = useCallback(
    async (
      input: RecommendationPdfInput | RecommendationPdfInputResolver,
      { allowFreeFallback = false, downloadKey = "default" }: DownloadPdfOptions = {}
    ) => {
      if (!pro && !allowFreeFallback) {
        showProRequiredToast();
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
        if (isPdfProRequiredError(error)) {
          showProRequiredToast();
        } else {
          toast(t("pdfFailed"), "error");
        }
        return false;
      } finally {
        setGeneratingKey(null);
      }
    },
    [pro, showProRequiredToast, t]
  );

  return {
    downloadPdf,
    isAnyPdfGenerating,
    /** @deprecated Use isGeneratingForKey */
    isGenerating: isAnyPdfGenerating,
    isGeneratingForKey,
    /** @deprecated Use isGeneratingForKey */
    isGeneratingForSession: isGeneratingForKey,
    isPro: pro,
  };
}
