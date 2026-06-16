"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarRange,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useCashFlowForecast } from "@/hooks/useCashFlowForecast";
import { ProEmptyState, ProPageHeader, StatCard } from "@/components/pro/pro-page";
import { ProPageSkeleton } from "@/components/pro/pro-skeletons";
import { ProRefreshingIndicator } from "@/components/pro/pro-refreshing-indicator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProForecastChart } from "@/components/pro/shared/pro-forecast-chart";
import { ProForecastMonthCards } from "@/components/pro/shared/pro-forecast-month-cards";
import { ProForecastInsightBanner } from "@/components/pro/shared/pro-forecast-insight-banner";
import { ProForecastRecommendations } from "@/components/pro/shared/pro-forecast-recommendations";
import { ProForecastTable } from "@/components/pro/shared/pro-forecast-table";
import { ProDashboardDebtTable } from "@/components/pro/dashboard/pro-dashboard-debt-table";
import { buildProEngineCashFlowContext } from "@/lib/pro/pro-engine-cashflow";
import { toFinancialProfile } from "@/lib/types/financial";
import { cn, formatMoney } from "@/lib/utils";
import type { Debt } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

/** 3-month cash flow forecast with chart, table, debts, and recommendations. */
export function ProForecastView() {
  const t = useTranslations("pro.forecast");
  const locale = useLocale() as Locale;
  const { summary, forecast, isLoading, isFetching, isError, error, refetch } =
    useCashFlowForecast();

  const firstMonth = forecast.months[0];
  const lastMonth = forecast.months[forecast.months.length - 1];

  const priorityDebts = useMemo(() => {
    const ids = new Set<string>();
    const merged: Debt[] = [];
    for (const debt of [...summary.criticalDebts, ...summary.urgentDebts]) {
      if (!ids.has(debt.id)) {
        ids.add(debt.id);
        merged.push(debt);
      }
    }
    return merged;
  }, [summary.criticalDebts, summary.urgentDebts]);

  const engineCashFlow = useMemo(() => {
    if (!summary.profile) return undefined;
    return buildProEngineCashFlowContext(toFinancialProfile(summary.profile));
  }, [summary.profile]);

  if (isLoading && !summary.profile) {
    return <ProPageSkeleton variant="forecast" label={t("title")} />;
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">{t("errorTitle")}</CardTitle>
          <CardDescription>{error?.message ?? t("errorGeneric")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void refetch()}>
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <ProPageHeader title={t("title")} description={t("subtitle")} />

      <ProRefreshingIndicator
        visible={isFetching && !isLoading}
        label={t("refreshingData")}
      />

      {!forecast.hasData ? (
        <ProEmptyState
          icon={<CalendarRange className="h-6 w-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link href={`/${locale}/pro/debts`}>
                  <Wallet className="mr-2 h-4 w-4" />
                  {t("addDebts")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${locale}/pro/incomes`}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {t("addIncomes")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${locale}/pro/expenses`}>
                  <TrendingDown className="mr-2 h-4 w-4" />
                  {t("addExpenses")}
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("startingBalance")}
              value={formatMoney(summary.availableFunds, locale)}
              icon={Wallet}
              accent="emerald"
              iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label={t("monthlyNet")}
              value={formatMoney(forecast.netMonthlyChange, locale)}
              hint={t("perMonth")}
              trend={forecast.netMonthlyChange >= 0 ? "positive" : "negative"}
              accent="blue"
              icon={TrendingUp}
              iconClassName={
                forecast.netMonthlyChange >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }
            />
            <StatCard
              label={t("projectedBalance")}
              value={formatMoney(firstMonth?.endingBalance ?? 0, locale)}
              hint={t("firstMonthHint")}
              trend={
                (firstMonth?.endingBalance ?? 0) >= 0 ? "positive" : "negative"
              }
              accent="violet"
              icon={CalendarRange}
            />
            <StatCard
              label={t("threeMonthBalance")}
              value={formatMoney(lastMonth?.endingBalance ?? 0, locale)}
              hint={t("threeMonthHint")}
              trend={
                (lastMonth?.endingBalance ?? 0) >= 0 ? "positive" : "negative"
              }
              accent={
                (lastMonth?.endingBalance ?? 0) >= 0 ? "emerald" : "destructive"
              }
              icon={CalendarRange}
              iconClassName={
                (lastMonth?.endingBalance ?? 0) >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }
            />
          </div>

          <ProForecastInsightBanner
            months={forecast.months}
            locale={locale}
            namespace="pro.forecast"
          />

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">{t("recommendationsTitle")}</CardTitle>
              <CardDescription>{t("recommendationsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProForecastRecommendations
                recommendations={forecast.recommendations}
                months={forecast.months}
                locale={locale}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("chartTitle")}</CardTitle>
                <CardDescription>{t("chartDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProForecastChart
                  months={forecast.months}
                  chartScaleMax={forecast.chartScaleMax}
                  locale={locale}
                  legend={t("chartLegend")}
                />
                <ProForecastMonthCards
                  months={forecast.months}
                  locale={locale}
                  perMonthLabel={t("perMonth")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("breakdownTitle")}</CardTitle>
                <CardDescription>{t("breakdownDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("recurringIncome")}
                  </span>
                  <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(summary.monthlyRecurringIncome, locale)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("recurringExpense")}
                  </span>
                  <span className="font-medium tabular-nums text-destructive">
                    −{formatMoney(summary.monthlyRecurringExpense, locale)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("minimumPayments")}
                  </span>
                  <span className="font-medium tabular-nums text-destructive">
                    −{formatMoney(summary.minimumPaymentsDue, locale)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-3 font-semibold">
                  <span>{t("netResult")}</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      forecast.netMonthlyChange >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    )}
                  >
                    {formatMoney(forecast.netMonthlyChange, locale)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tableTitle")}</CardTitle>
              <CardDescription>{t("tableDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <ProForecastTable months={forecast.months} locale={locale} />
            </CardContent>
          </Card>

          {priorityDebts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("debtsTitle")}</CardTitle>
                <CardDescription>{t("debtsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <ProDashboardDebtTable
                  debts={priorityDebts}
                  locale={locale}
                  cashFlow={engineCashFlow}
                  emptyTitle={t("debtsEmptyTitle")}
                  emptyHint={t("debtsEmptyHint")}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
