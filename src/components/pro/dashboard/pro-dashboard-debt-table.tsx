"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { analyzeDebt } from "@/services/priorityEngine";
import type { ProEngineCashFlowContext } from "@/lib/pro/pro-engine-cashflow";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Debt } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

interface ProDashboardDebtTableProps {
  debts: Debt[];
  locale: Locale;
  cashFlow?: ProEngineCashFlowContext;
  emptyTitle: string;
  emptyHint: string;
}

export const ProDashboardDebtTable = memo(function ProDashboardDebtTable({
  debts,
  locale,
  cashFlow,
  emptyTitle,
  emptyHint,
}: ProDashboardDebtTableProps) {
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
          const analysis = analyzeDebt(debt, new Date(), { cashFlow });
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
