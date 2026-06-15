"use client";

import { memo, useCallback, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  LayoutDashboard,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PdfDownloadButton } from "@/components/pdf/pdf-download-button";
import { analyzeDebt, runPriorityEngine } from "@/services/priorityEngine";
import { useProFinancialSummary, type ProFinancialSummary } from "@/hooks/useProFinancial";
import { buildEngineProfileFromUser } from "@/lib/pro/pro-engine-cashflow";
import { useRecommendationPdfDownload, PRO_DASHBOARD_PDF_KEY } from "@/hooks/use-recommendation-pdf";
import { ProPageSkeleton } from "@/components/pro/pro-skeletons";
import { ProEmptyState, ProPageHeader, StatCard } from "@/components/pro/pro-page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/utils";
import { isPaidTier } from "@/lib/types/financial";
import type { Debt } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";
import { hasMinimumRecommendationData } from "@/lib/grok/recommendation-readiness";

/** Whether the profile has no meaningful financial data yet. */
function isProfileEmpty(summary: ProFinancialSummary) {
  return (
    summary.debtCount === 0 &&
    summary.monthlyRecurringIncome === 0 &&
    summary.monthlyRecurringExpense === 0 &&
    summary.availableFunds === 0
  );
}

const DebtPriorityTable = memo(function DebtPriorityTable({
  debts,
  locale,
  emptyTitle,
  emptyHint,
}: {
  debts: Debt[];
  locale: Locale;
  emptyTitle: string;
  emptyHint: string;
}) {
  const t = useTranslations("pro.dashboard");

  if (debts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 py-8 text-center">
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("creditor")}</TableHead>
          <TableHead>{t("amount")}</TableHead>
          <TableHead>{t("dueDate")}</TableHead>
          <TableHead>{t("priority")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {debts.map((debt) => {
          const analysis = analyzeDebt(debt);
          return (
            <TableRow key={debt.id}>
              <TableCell className="font-medium">{debt.creditor}</TableCell>
              <TableCell className="tabular-nums">
                {formatMoney(debt.amount, locale)}
              </TableCell>
              <TableCell>
                {debt.dueDate
                  ? formatDate(debt.dueDate, locale)
                  : debt.criticalDate
                    ? formatDate(debt.criticalDate, locale)
                    : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={analysis.level === 0 ? "warning" : "secondary"}>
                  {t("priorityLevel", { level: analysis.level })}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
});

/** Pro dashboard — cash flow, debt summary, urgent & critical obligations. */
export function ProDashboardView() {
  const t = useTranslations("pro.dashboard");
  const locale = useLocale() as Locale;
  const { summary, isLoading, isError, error, refetch } =
    useProFinancialSummary();
  const { downloadPdf, isGeneratingForKey, isPro } = useRecommendationPdfDownload();
  const isGeneratingPdf = isGeneratingForKey(PRO_DASHBOARD_PDF_KEY);

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
        description={t("subtitle")}
        action={
          canExportPdf ? (
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
          ) : undefined
        }
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
        <ProEmptyState
          icon={<LayoutDashboard className="h-6 w-6" />}
          title={t("emptyProfileTitle")}
          description={t("emptyProfileDescription")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href={`/${locale}/pro/debts`}>{t("addDebt")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${locale}/manual`}>{t("addViaManual")}</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Key metrics */}
          <section aria-labelledby="pro-metrics-heading">
            <h2 id="pro-metrics-heading" className="sr-only">
              {t("metricsHeading")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={t("availableFunds")}
                value={formatMoney(summary.availableFunds, locale)}
                hint={summary.currency}
                icon={Wallet}
                iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              />
              <StatCard
                label={t("netCashFlow")}
                value={formatMoney(summary.netMonthlyCashFlow, locale)}
                hint={t("perMonth")}
                trend={cashFlowTrend}
                icon={TrendingUp}
                iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              />
              <StatCard
                label={t("urgentCount")}
                value={String(summary.urgentDebts.length)}
                hint={t("urgentCountHint")}
                trend={summary.urgentDebts.length > 0 ? "negative" : "neutral"}
                icon={AlertTriangle}
                iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              />
              <StatCard
                label={t("criticalDebtsTitle")}
                value={String(summary.criticalDebts.length)}
                hint={t("criticalDebtsHint")}
                trend={summary.criticalDebts.length > 0 ? "negative" : "neutral"}
                icon={AlertOctagon}
                iconClassName="bg-destructive/10 text-destructive"
              />
            </div>
          </section>

          {/* Cash flow breakdown */}
          <section className="grid gap-4 lg:grid-cols-2">
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
                  <span className="tabular-nums">
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
                  <span className="text-muted-foreground">{t("incomeStability")}</span>
                  <span className="font-medium capitalize">
                    {summary.effectiveIncomeStability &&
                    summary.effectiveIncomeStability !== summary.incomeStability
                      ? `${summary.incomeStability ?? "—"} → ${summary.effectiveIncomeStability}`
                      : (summary.incomeStability ?? "—")}
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

          {prioritization && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("engineInsightTitle")}</CardTitle>
                <CardDescription>{t("engineInsightDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{prioritization.summary}</p>
                {prioritization.warnings.length > 0 && (
                  <ul className="space-y-2 text-muted-foreground">
                    {prioritization.warnings.slice(0, 4).map((warning, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="shrink-0 text-amber-600">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-4 border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    {t("engineLifeBuffer")}:{" "}
                    <strong className="text-foreground">
                      {formatMoney(prioritization.lifeBuffer, locale)}
                    </strong>
                  </span>
                  <span>
                    {t("engineSpendable")}:{" "}
                    <strong className="text-foreground">
                      {formatMoney(prioritization.spendableFunds, locale)}
                    </strong>
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Critical debts */}
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
              <DebtPriorityTable
                debts={summary.criticalDebts}
                locale={locale}
                emptyTitle={t("noCriticalDebts")}
                emptyHint={t("noCriticalDebtsHint")}
              />
            </CardContent>
          </Card>

          {/* Urgent debts (levels 0–1) */}
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
                <DebtPriorityTable
                  debts={summary.urgentDebts}
                  locale={locale}
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
