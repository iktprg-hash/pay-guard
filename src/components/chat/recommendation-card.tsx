"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/utils";
import {
  priorityLevelMessageKey,
  resolvePriorityLevel,
} from "@/lib/financial/priorityLevel";
import type {
  FinancialProfile,
  PrioritizationResult,
  UserFinancialProfile,
} from "@/lib/types/financial";
import { useRecommendationPdfDownload } from "@/hooks/use-recommendation-pdf";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";

const LEVEL_VARIANT: Record<number, "default" | "warning" | "secondary" | "outline"> = {
  0: "default",
  1: "warning",
  2: "secondary",
  3: "outline",
};

interface RecommendationCardProps {
  result: PrioritizationResult;
  profile?: FinancialProfile | UserFinancialProfile;
  /** Scopes PDF loading spinner (e.g. chat session id). */
  downloadKey?: string;
}

export function RecommendationCard({
  result,
  profile,
  downloadKey = "chat-recommendation",
}: RecommendationCardProps) {
  const t = useTranslations("recommendation");
  const tCat = useTranslations("categories");
  const appLocale = useLocale() as Locale;
  const { pro } = useSubscriptionTier();
  const { downloadPdf, isGeneratingForSession } = useRecommendationPdfDownload();
  const isGenerating = isGeneratingForSession(downloadKey);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          {t("title")}
        </CardTitle>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{result.summary}</p>
          {pro ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              disabled={isGenerating}
              onClick={() =>
                void downloadPdf(
                  {
                    recommendation: result,
                    profile,
                    locale: appLocale,
                  },
                  { downloadKey }
                )
              }
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {isGenerating ? t("generatingPdf") : t("downloadPdf")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              asChild
            >
              <Link href={`/${appLocale}/pricing`}>{t("exportPdfPro")}</Link>
            </Button>
          )}
        </div>
        {result.lifeBuffer > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("lifeBuffer")}: {formatMoney(result.lifeBuffer, appLocale)} (
            {Math.round(result.lifeBufferPercent * 100)} %)
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {result.recommendations.map((rec, i) => {
          const level = resolvePriorityLevel(rec);
          return (
          <div key={rec.debtId} className="rounded-lg border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">#{i + 1}</span>
                  <span>{rec.creditor}</span>
                  <Badge variant={LEVEL_VARIANT[level] ?? "secondary"}>
                    {t(priorityLevelMessageKey(rec))}
                  </Badge>
                  <Badge variant="outline">{tCat(rec.category)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{rec.reason}</p>
                {rec.explanation && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">
                    {rec.explanation}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("amount")}</p>
                <p className="text-lg font-bold text-primary">
                  {formatMoney(rec.recommendedAmount, appLocale)}
                </p>
              </div>
            </div>
          </div>
          );
        })}

        <Separator />

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("remaining")}</span>
          <span className="font-medium">{formatMoney(result.remainingFunds, appLocale)}</span>
        </div>

        {result.warnings.length > 0 && (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {t("warnings")}
            </p>
            <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-400">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
