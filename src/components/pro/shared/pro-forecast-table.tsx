"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
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

/** Month-by-month forecast breakdown with deficit row highlighting. */
export const ProForecastTable = memo(function ProForecastTable({
  months,
  locale,
}: ProForecastTableProps) {
  const t = useTranslations("pro.forecast");

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t("colMonth")}</TableHead>
          <TableHead className="text-right">{t("colIncome")}</TableHead>
          <TableHead className="text-right">{t("colExpenses")}</TableHead>
          <TableHead className="text-right">{t("colDebtPayments")}</TableHead>
          <TableHead className="text-right">{t("colNetChange")}</TableHead>
          <TableHead className="text-right">{t("colEndBalance")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.map((month) => {
          const isDeficit = month.endingBalance < 0;
          return (
            <TableRow
              key={month.yearMonth}
              className={cn(
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
    </Table>
  );
});
