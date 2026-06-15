"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import type { ProFinancialSummary } from "@/hooks/useProFinancial";
import type { Locale } from "@/i18n/routing";

interface ProDashboardEngineEmptyProps {
  summary: ProFinancialSummary;
  locale: Locale;
}

/** Engine insight placeholder when cash flow exists but debts are missing. */
export function ProDashboardEngineEmpty({
  summary,
  locale,
}: ProDashboardEngineEmptyProps) {
  const t = useTranslations("pro.dashboard");
  const hasCashFlow =
    summary.monthlyRecurringIncome > 0 || summary.monthlyRecurringExpense > 0;

  return (
    <Card className="flex h-full flex-col border-dashed border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
          {t("engineInsightTitle")}
        </CardTitle>
        <CardDescription>{t("engineNoDebtsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-4 pb-8">
        {hasCashFlow && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">{t("netCashFlow")}</p>
            <p
              className={
                summary.netMonthlyCashFlow < 0
                  ? "text-lg font-bold tabular-nums text-destructive"
                  : "text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
              }
            >
              {formatMoney(summary.netMonthlyCashFlow, locale)}
            </p>
          </div>
        )}
        <Button asChild className="w-full sm:w-auto">
          <Link href={`/${locale}/pro/debts`}>
            <CreditCard className="mr-2 h-4 w-4" />
            {t("addDebt")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
