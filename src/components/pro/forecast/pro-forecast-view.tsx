"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarRange,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useProFinancialSummary } from "@/hooks/useProFinancial";
import { ProEmptyState, ProPageHeader, StatCard } from "@/components/pro/pro-page";
import { ProPageSkeleton } from "@/components/pro/pro-skeletons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

/** Monthly forecast — projected cash flow from recurring items. */
export function ProForecastView() {
  const t = useTranslations("pro.forecast");
  const locale = useLocale() as Locale;
  const { summary, isLoading, isError, error, refetch } =
    useProFinancialSummary();

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

  const projectedEndOfMonth =
    summary.availableFunds + summary.netMonthlyCashFlow;

  const hasData =
    summary.debtCount > 0 ||
    summary.monthlyRecurringIncome > 0 ||
    summary.monthlyRecurringExpense > 0;

  return (
    <div className="space-y-8">
      <ProPageHeader title={t("title")} description={t("subtitle")} />

      {!hasData ? (
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
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={t("startingBalance")}
              value={formatMoney(summary.availableFunds, locale)}
              icon={Wallet}
            />
            <StatCard
              label={t("projectedChange")}
              value={formatMoney(summary.netMonthlyCashFlow, locale)}
              hint={t("perMonth")}
              trend={
                summary.netMonthlyCashFlow >= 0 ? "positive" : "negative"
              }
              icon={TrendingUp}
            />
            <StatCard
              label={t("projectedBalance")}
              value={formatMoney(projectedEndOfMonth, locale)}
              hint={t("endOfMonthHint")}
              trend={projectedEndOfMonth >= 0 ? "positive" : "negative"}
              icon={CalendarRange}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("breakdownTitle")}</CardTitle>
              <CardDescription>{t("breakdownDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("minimumPayments")}</span>
                <span className="font-medium tabular-nums text-destructive">
                  −{formatMoney(summary.minimumPaymentsDue, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("recurringIncome")}</span>
                <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatMoney(summary.monthlyRecurringIncome, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("recurringExpense")}</span>
                <span className="font-medium tabular-nums text-destructive">
                  −{formatMoney(summary.monthlyRecurringExpense, locale)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-3 font-semibold">
                <span>{t("netResult")}</span>
                <span className="tabular-nums">
                  {formatMoney(summary.netMonthlyCashFlow, locale)}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
