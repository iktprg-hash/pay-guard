"use client";

import { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ForecastMonth } from "@/lib/pro/cash-flow-forecast";
import { formatForecastMonth } from "@/lib/pro/format-forecast-month";
import { cn, formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

interface ProForecastTableProps {
  months: ForecastMonth[];
  locale: Locale;
}

/** Month-by-month forecast breakdown with deficit highlighting and 3-month totals. */
export const ProForecastTable = memo(function ProForecastTable({
  months,
  locale,
}: ProForecastTableProps) {
  const t = useTranslations("pro.forecast");

  const totals = useMemo(() => {
    return months.reduce(
      (acc, month) => ({
        income: acc.income + month.income,
        expenses: acc.expenses + month.expenses,
        debtPayments: acc.debtPayments + month.debtPayments,
        netChange: acc.netChange + month.netChange,
      }),
      { income: 0, expenses: 0, debtPayments: 0, netChange: 0 }
    );
  }, [months]);

  const lastBalance = months.at(-1)?.endingBalance ?? 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>{t("colMonth")}</TableHead>
            <TableHead className="text-right">{t("colIncome")}</TableHead>
            <TableHead className="text-right">{t("colExpenses")}</TableHead>
            <TableHead className="text-right">{t("colDebtPayments")}</TableHead>
            <TableHead className="text-right">{t("colNetChange")}</TableHead>
            <TableHead className="text-right">{t("colEndBalance")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((month, rowIndex) => {
            const isDeficit = month.endingBalance < 0;
            return (
              <TableRow
                key={month.yearMonth}
                className={cn(
                  rowIndex % 2 === 1 && "bg-muted/20",
                  isDeficit && "bg-destructive/5 hover:bg-destructive/10"
                )}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    {formatForecastMonth(month.yearMonth, locale)}
                    {isDeficit && (
                      <Badge variant="warning" className="text-[10px]">
                        {t("deficitBadge")}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatMoney(month.income, locale)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-destructive">
                  −{formatMoney(month.expenses, locale)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-destructive">
                  −{formatMoney(month.debtPayments, locale)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums font-medium",
                    month.netChange >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}
                >
                  {formatMoney(month.netChange, locale)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums font-semibold",
                    isDeficit
                      ? "text-destructive"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {formatMoney(month.endingBalance, locale)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted/30 font-medium hover:bg-muted/30">
            <TableCell>{t("tableTotalRow")}</TableCell>
            <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
              +{formatMoney(totals.income, locale)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-destructive">
              −{formatMoney(totals.expenses, locale)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-destructive">
              −{formatMoney(totals.debtPayments, locale)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                totals.netChange >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}
            >
              {formatMoney(totals.netChange, locale)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums font-semibold",
                lastBalance >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}
            >
              {formatMoney(lastBalance, locale)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
});
