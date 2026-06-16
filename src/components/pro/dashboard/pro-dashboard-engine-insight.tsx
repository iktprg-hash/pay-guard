"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Lightbulb, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import type { PrioritizationResult } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

interface ProDashboardEngineInsightProps {
  prioritization: PrioritizationResult;
  locale: Locale;
}

/** Priority Engine output with top recommendations and recurring-aware metrics. */
export function ProDashboardEngineInsight({
  prioritization,
  locale,
}: ProDashboardEngineInsightProps) {
  const t = useTranslations("pro.dashboard");
  const topRecs = prioritization.recommendations.slice(0, 3);

  return (
    <Card className="h-full border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
            {t("engineInsightTitle")}
          </CardTitle>
          <CardDescription>{t("engineInsightDescription")}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/pro/debts`}>
            {t("manageDebts")}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="leading-relaxed">{prioritization.summary}</p>

        {(prioritization.monthlyRecurringIncome != null ||
          prioritization.monthlyRecurringExpense != null) && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background/60 p-3 text-xs">
            {prioritization.monthlyRecurringIncome != null && (
              <div>
                <p className="text-muted-foreground">{t("recurringIncome")}</p>
                <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatMoney(prioritization.monthlyRecurringIncome, locale)}
                </p>
              </div>
            )}
            {prioritization.monthlyRecurringExpense != null && (
              <div>
                <p className="text-muted-foreground">{t("recurringExpense")}</p>
                <p className="font-semibold tabular-nums text-destructive">
                  −{formatMoney(prioritization.monthlyRecurringExpense, locale)}
                </p>
              </div>
            )}
          </div>
        )}

        {topRecs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("engineRecommendationsTitle")}
            </p>
            <ul className="space-y-2">
              {topRecs.map((rec, i) => (
                <li
                  key={rec.debtId}
                  className="flex items-start justify-between gap-2 rounded-lg border bg-background/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {i + 1}. {rec.creditor}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {rec.reason}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {formatMoney(rec.recommendedAmount, locale)}
                    </p>
                    <Badge
                      variant={rec.priorityLevel === 0 ? "warning" : "secondary"}
                      className="mt-1 text-[10px]"
                    >
                      {t("priorityLevel", { level: rec.priorityLevel })}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground">{t("engineNoRecommendations")}</p>
        )}

        {prioritization.warnings.length > 0 && (
          <ul className="space-y-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            {prioritization.warnings.slice(0, 3).map((warning, i) => (
              <li key={i} className="flex gap-2">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs text-muted-foreground">
          {prioritization.planningAvailableFunds != null && (
            <div>
              <p>{t("enginePlanningFunds")}</p>
              <p className="font-semibold tabular-nums text-foreground">
                {formatMoney(prioritization.planningAvailableFunds, locale)}
              </p>
            </div>
          )}
          <div>
            <p>{t("engineLifeBuffer")}</p>
            <p className="font-semibold tabular-nums text-foreground">
              {formatMoney(prioritization.lifeBuffer, locale)}
            </p>
          </div>
          <div>
            <p>{t("engineSpendable")}</p>
            <p className="font-semibold tabular-nums text-foreground">
              {formatMoney(prioritization.spendableFunds, locale)}
            </p>
          </div>
          {prioritization.shortTermForecast?.[0] && (
            <div>
              <p>{t("engineForecastMonth", { month: 1 })}</p>
              <p
                className={
                  prioritization.shortTermForecast[0].endingBalance < 0
                    ? "font-semibold tabular-nums text-destructive"
                    : "font-semibold tabular-nums text-foreground"
                }
              >
                {formatMoney(
                  prioritization.shortTermForecast[0].endingBalance,
                  locale
                )}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
