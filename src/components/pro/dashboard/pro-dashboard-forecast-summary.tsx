"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { ProForecastChart } from "@/components/pro/shared/pro-forecast-chart";
import { ProForecastMonthCards } from "@/components/pro/shared/pro-forecast-month-cards";
import { ProForecastInsightBanner } from "@/components/pro/shared/pro-forecast-insight-banner";
import { ProForecastRecommendations } from "@/components/pro/shared/pro-forecast-recommendations";
import { ProForecastConclusion } from "@/components/pro/shared/pro-forecast-conclusion";
import type { CashFlowForecastResult } from "@/lib/pro/cash-flow-forecast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  return (
    <Card className="overflow-hidden border-violet-500/20">
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
        <ProForecastInsightBanner months={forecast.months} locale={locale} />

        <ProForecastConclusion
          months={forecast.months}
          netMonthlyChange={forecast.netMonthlyChange}
          locale={locale}
          namespace="pro.dashboard"
          compact
        />

        <ProForecastChart
          months={forecast.months}
          chartScaleMax={forecast.chartScaleMax}
          locale={locale}
          compact
          legend={t("forecastChartLegend")}
        />

        <ProForecastMonthCards months={forecast.months} locale={locale} />

        {forecast.recommendations.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("forecastRecsTitle")}
            </p>
            <ProForecastRecommendations
              recommendations={forecast.recommendations}
              months={forecast.months}
              locale={locale}
              limit={2}
              compact
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
