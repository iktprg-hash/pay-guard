"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { ProForecastChart } from "@/components/pro/shared/pro-forecast-chart";
import { formatForecastMonth } from "@/lib/pro/format-forecast-month";
import type { CashFlowForecastResult } from "@/lib/pro/cash-flow-forecast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

interface ProDashboardForecastSummaryProps {
  forecast: CashFlowForecastResult;
}

/** Compact 3-month forecast chart + month cards for the Pro dashboard. */
export function ProDashboardForecastSummary({
  forecast,
}: ProDashboardForecastSummaryProps) {
  const t = useTranslations("pro.dashboard");
  const locale = useLocale() as Locale;

  if (!forecast.hasData || forecast.months.length === 0) {
    return null;
  }

  const lastMonth = forecast.months[forecast.months.length - 1];
  const hasDeficit = forecast.months.some((m) => m.endingBalance < 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{t("forecastSummaryTitle")}</CardTitle>
          <CardDescription>{t("forecastSummaryDescription")}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/pro/forecast`}>
            {t("forecastViewDetails")}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProForecastChart
          months={forecast.months}
          chartScaleMax={forecast.chartScaleMax}
          locale={locale}
          compact
          legend={t("forecastChartLegend")}
        />

        <div className="grid gap-2 sm:grid-cols-3">
          {forecast.months.map((month) => {
            const positive = month.endingBalance >= 0;
            return (
              <div
                key={month.yearMonth}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  positive
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-destructive/20 bg-destructive/5"
                )}
              >
                <p className="text-xs text-muted-foreground">
                  {formatForecastMonth(month.yearMonth, locale)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-sm font-bold tabular-nums",
                    positive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}
                >
                  {formatMoney(month.endingBalance, locale)}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  {month.netChange >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  {formatMoney(month.netChange, locale)} {t("perMonth")}
                </p>
              </div>
            );
          })}
        </div>

        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            hasDeficit
              ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100"
              : "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100"
          )}
        >
          {hasDeficit
            ? t("forecastDeficitWarning", {
                month: formatForecastMonth(lastMonth.yearMonth, locale),
              })
            : t("forecastHealthySummary", {
                amount: formatMoney(lastMonth.endingBalance, locale),
                month: formatForecastMonth(lastMonth.yearMonth, locale),
              })}
        </div>
      </CardContent>
    </Card>
  );
}
