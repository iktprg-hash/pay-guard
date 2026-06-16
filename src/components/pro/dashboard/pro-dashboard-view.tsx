"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  LayoutDashboard,
  LineChart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PdfDownloadButton } from "@/components/pdf/pdf-download-button";
import { runPriorityEngine } from "@/services/priorityEngine";
import { useCashFlowForecast } from "@/hooks/useCashFlowForecast";
import {
  buildEngineProfileFromUser,
  buildProEngineCashFlowContext,
} from "@/lib/pro/pro-engine-cashflow";
import { toFinancialProfile } from "@/lib/types/financial";
import { useRecommendationPdfDownload, PRO_DASHBOARD_PDF_KEY } from "@/hooks/use-recommendation-pdf";
import { ProPageSkeleton } from "@/components/pro/pro-skeletons";
import { ProEmptyState, ProPageHeader, ProSectionHeading, StatCard } from "@/components/pro/pro-page";
import { ProDashboardQuickActions } from "@/components/pro/dashboard/pro-dashboard-quick-actions";
import { ProDashboardHealthBanner } from "@/components/pro/dashboard/pro-dashboard-health-banner";
import { ProDashboardForecastSummary } from "@/components/pro/dashboard/pro-dashboard-forecast-summary";
import { ProDashboardEngineInsight } from "@/components/pro/dashboard/pro-dashboard-engine-insight";
import { ProDashboardForecastEmpty } from "@/components/pro/dashboard/pro-dashboard-forecast-empty";
import { ProDashboardEngineEmpty } from "@/components/pro/dashboard/pro-dashboard-engine-empty";
import { ProDashboardProfileSettings } from "@/components/pro/dashboard/pro-dashboard-profile-settings";
import { ProDashboardDebtTable } from "@/components/pro/dashboard/pro-dashboard-debt-table";
import { ProRefreshingIndicator } from "@/components/pro/pro-refreshing-indicator";
import { formatIncomeStabilityDisplay } from "@/lib/pro/format-income-stability";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney, getIntlLocale } from "@/lib/utils";
import { isPaidTier } from "@/lib/types/financial";
import type { ProFinancialSummary } from "@/hooks/useProFinancial";
import type { Locale } from "@/i18n/routing";
import { hasMinimumRecommendationData } from "@/lib/grok/recommendation-readiness";

function isProfileEmpty(summary: ProFinancialSummary) {
  return (
    summary.debtCount === 0 &&
    summary.monthlyRecurringIncome === 0 &&
    summary.monthlyRecurringExpense === 0 &&
    summary.availableFunds === 0
  );
}

/** Pro dashboard — command center for cash flow, forecast, and payment priorities. */
export function ProDashboardView() {
  const t = useTranslations("pro.dashboard");
  const locale = useLocale() as Locale;
  const { summary, forecast, isLoading, isFetching, isError, error, refetch } =
    useCashFlowForecast();
  const { downloadPdf, isGeneratingForKey, isPro } = useRecommendationPdfDownload();
  const isGeneratingPdf = isGeneratingForKey(PRO_DASHBOARD_PDF_KEY);

  const engineCashFlow = useMemo(() => {
    if (!summary.profile) return undefined;
    return buildProEngineCashFlowContext(toFinancialProfile(summary.profile));
  }, [summary.profile]);

  const canExportPdf = useMemo(
    () =>
      isPro &&
      Boolean(summary.profile) &&
      hasMinimumRecommendationData({
        availableFunds: summary.profile?.availableFunds ?? 0,
        debts: summary.profile?.debts ?? [],
      }),
    [isPro, summary.profile]
  );

  const handleDownloadPdf = useCallback(() => {
    if (!summary.profile) return;
    const profile = buildEngineProfileFromUser(summary.profile);
    if (!hasMinimumRecommendationData(profile)) return;
    const recommendation = runPriorityEngine(profile, locale);
    void downloadPdf(
      { recommendation, profile, locale },
      { downloadKey: PRO_DASHBOARD_PDF_KEY }
    );
  }, [downloadPdf, locale, summary.profile]);

  const prioritization = useMemo(() => {
    if (!summary.profile || summary.debtCount === 0) return null;
    const profile = buildEngineProfileFromUser(summary.profile);
    if (!hasMinimumRecommendationData(profile)) return null;
    return runPriorityEngine(profile, locale);
  }, [summary.profile, summary.debtCount, locale]);

  const paid = useMemo(
    () => isPaidTier(summary.subscriptionTier),
    [summary.subscriptionTier]
  );
  const empty = useMemo(() => isProfileEmpty(summary), [summary]);
  const cashFlowTrend = useMemo(
    () =>
      summary.netMonthlyCashFlow > 0
        ? "positive"
        : summary.netMonthlyCashFlow < 0
          ? "negative"
          : "neutral",
    [summary.netMonthlyCashFlow]
  );

  const forecastEndBalance = forecast.months.at(-1)?.endingBalance;

  const lastUpdatedLabel = useMemo(() => {
    if (!summary.lastUpdated) return null;
    return new Intl.DateTimeFormat(getIntlLocale(locale), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(summary.lastUpdated));
  }, [summary.lastUpdated, locale]);

  if (isLoading) {
    return <ProPageSkeleton variant="dashboard" label={t("title")} />;
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
      <ProPageHeader
        title={t("title")}
        description={
          lastUpdatedLabel && !empty
            ? `${t("subtitle")} · ${t("lastUpdated", { date: lastUpdatedLabel })}`
            : t("subtitle")
        }
        action={
          !empty || canExportPdf ? (
            <div className="flex flex-wrap gap-2">
              {!empty && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${locale}/pro/forecast`}>
                    {t("forecastViewDetails")}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
              {canExportPdf ? (
                <PdfDownloadButton
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  iconClassName="h-4 w-4"
                  isGenerating={isGeneratingPdf}
                  downloadLabel={t("downloadPdf")}
                  generatingLabel={t("generatingPdf")}
                  onClick={handleDownloadPdf}
                />
              ) : null}
            </div>
          ) : undefined
        }
      />

      <ProRefreshingIndicator
        visible={isFetching && !isLoading}
        label={t("refreshingData")}
      />

      {!paid && (
        <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{t("upgradeTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("upgradeDescription")}
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href={`/${locale}/pricing`}>{t("upgradeCta")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {empty ? (
        <>
          <ProDashboardQuickActions
            debtCount={0}
            incomeTotal={0}
            expenseTotal={0}
          />
          <div className="max-w-md">
            <ProDashboardProfileSettings
              availableFunds={summary.availableFunds}
              incomeStability={summary.incomeStability}
            />
          </div>
          <ProEmptyState
            icon={<LayoutDashboard className="h-6 w-6" />}
            title={t("emptyProfileTitle")}
            description={t("emptyProfileDescription")}
            steps={[t("gettingStartedStep1"), t("gettingStartedStep2"), t("gettingStartedStep3")]}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href={`/${locale}/pro/debts`}>{t("addDebt")}</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/${locale}/pro/incomes`}>{t("quickIncomes")}</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/${locale}/pro/expenses`}>{t("quickExpenses")}</Link>
                </Button>
              </div>
            }
          />
        </>
      ) : (
        <>
          <ProDashboardHealthBanner
            criticalCount={summary.criticalDebts.length}
            netMonthlyCashFlow={summary.netMonthlyCashFlow}
            labels={{
              critical: t("healthCritical", {
                count: summary.criticalDebts.length,
              }),
              deficit: t("healthDeficit", {
                amount: formatMoney(
                  Math.abs(summary.netMonthlyCashFlow),
                  locale
                ),
              }),
              healthy: t("healthHealthy"),
            }}
          />

          <ProDashboardQuickActions
            debtCount={summary.debtCount}
            incomeTotal={summary.monthlyRecurringIncome}
            expenseTotal={summary.monthlyRecurringExpense}
          />

          <section aria-labelledby="pro-metrics-heading">
            <ProSectionHeading
              id="pro-metrics-heading"
              title={t("metricsHeading")}
              description={t("metricsDescription")}
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label={t("availableFunds")}
                value={formatMoney(summary.availableFunds, locale)}
                hint={summary.currency}
                icon={Wallet}
                accent="emerald"
                iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              />
              <StatCard
                label={t("netCashFlow")}
                value={formatMoney(summary.netMonthlyCashFlow, locale)}
                hint={t("perMonth")}
                trend={cashFlowTrend}
                accent="blue"
                icon={TrendingUp}
                iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              />
              <StatCard
                label={t("urgentCount")}
                value={String(summary.urgentDebts.length)}
                hint={t("urgentCountHint")}
                trend={summary.urgentDebts.length > 0 ? "negative" : "neutral"}
                accent={summary.urgentDebts.length > 0 ? "amber" : "neutral"}
                icon={AlertTriangle}
                iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              />
              <StatCard
                label={t("criticalDebtsTitle")}
                value={String(summary.criticalDebts.length)}
                hint={t("criticalDebtsHint")}
                trend={summary.criticalDebts.length > 0 ? "negative" : "neutral"}
                accent={summary.criticalDebts.length > 0 ? "destructive" : "neutral"}
                icon={AlertOctagon}
                iconClassName="bg-destructive/10 text-destructive"
              />
              <StatCard
                label={t("forecastEndBalance")}
                value={
                  forecastEndBalance != null
                    ? formatMoney(forecastEndBalance, locale)
                    : "—"
                }
                hint={t("forecastEndBalanceHint")}
                trend={
                  forecastEndBalance != null && forecastEndBalance < 0
                    ? "negative"
                    : forecastEndBalance != null && forecastEndBalance > 0
                      ? "positive"
                      : "neutral"
                }
                accent="violet"
                icon={LineChart}
                iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
              />
            </div>
          </section>

          <section aria-labelledby="pro-outlook-heading">
            <ProSectionHeading
              id="pro-outlook-heading"
              title={t("outlookHeading")}
              description={t("outlookDescription")}
              className="mb-4"
            />
            <div className="grid gap-4 xl:grid-cols-5">
            <div className="xl:col-span-3">
              {forecast.hasData && forecast.months.length > 0 ? (
                <ProDashboardForecastSummary forecast={forecast} />
              ) : (
                <ProDashboardForecastEmpty />
              )}
            </div>
            <div className="xl:col-span-2">
              {prioritization ? (
                <ProDashboardEngineInsight
                  prioritization={prioritization}
                  locale={locale}
                />
              ) : (
                <ProDashboardEngineEmpty summary={summary} locale={locale} />
              )}
            </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <ProDashboardProfileSettings
              availableFunds={summary.availableFunds}
              incomeStability={summary.incomeStability}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("cashFlowTitle")}</CardTitle>
                <CardDescription>{t("cashFlowDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    {t("recurringIncome")}
                  </span>
                  <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(summary.monthlyRecurringIncome, locale)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    {t("recurringExpense")}
                  </span>
                  <span className="font-medium tabular-nums text-destructive">
                    −{formatMoney(summary.monthlyRecurringExpense, locale)}
                  </span>
                </div>
                {summary.minimumPaymentsDue > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      {t("minimumDebtPayments")}
                    </span>
                    <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                      −{formatMoney(summary.minimumPaymentsDue, locale)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                  <span>{t("netCashFlow")}</span>
                  <span
                    className={
                      summary.netMonthlyCashFlow < 0
                        ? "tabular-nums text-destructive"
                        : "tabular-nums text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {formatMoney(summary.netMonthlyCashFlow, locale)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("snapshotTitle")}</CardTitle>
                <CardDescription>{t("snapshotDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("planningFundsLabel")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(summary.planningAvailableFunds, locale)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("monthlyIncome")}</span>
                  <span className="font-medium tabular-nums">
                    {summary.monthlyIncome != null
                      ? formatMoney(summary.monthlyIncome, locale)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("monthlyExpenses")}</span>
                  <span className="font-medium tabular-nums">
                    {summary.monthlyExpenses != null
                      ? formatMoney(summary.monthlyExpenses, locale)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("engineEffectiveStability")}</span>
                  <span className="font-medium">
                    {formatIncomeStabilityDisplay(
                      summary.incomeStability,
                      summary.effectiveIncomeStability,
                      t
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-muted-foreground">{t("totalDebts")}</span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(summary.totalDebtAmount, locale)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-destructive/20">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertOctagon className="h-4 w-4 text-destructive" aria-hidden />
                  {t("criticalDebtsTitle")}
                </CardTitle>
                <CardDescription>{t("criticalDebtsDescription")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/pro/debts`}>
                  {t("manageDebts")}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <ProDashboardDebtTable
                debts={summary.criticalDebts}
                locale={locale}
                cashFlow={engineCashFlow}
                emptyTitle={t("noCriticalDebts")}
                emptyHint={t("noCriticalDebtsHint")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                  {t("urgentDebtsTitle")}
                </CardTitle>
                <CardDescription>{t("urgentDebtsDescription")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/pro/debts`}>
                  {t("manageDebts")}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {summary.urgentDebts.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 py-10 text-center">
                  <p className="text-sm font-medium">{t("noUrgentDebts")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("noUrgentDebtsHint")}
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href={`/${locale}/pro/debts`}>{t("addDebt")}</Link>
                  </Button>
                </div>
              ) : (
                <ProDashboardDebtTable
                  debts={summary.urgentDebts}
                  locale={locale}
                  cashFlow={engineCashFlow}
                  emptyTitle={t("noUrgentDebts")}
                  emptyHint={t("noUrgentDebtsHint")}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
