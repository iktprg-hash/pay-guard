"use client";

import { useMemo } from "react";
import { useRecurringIncomes } from "@/hooks/useProFinancial";
import type { RecurringIncome } from "@/lib/types/financial";
import {
  projectRecurringByMonth,
  sumMonthlyEquivalent,
  sumProjectionTotal,
  type MonthCashProjection,
} from "@/lib/pro/recurring-projection";

export interface UseRecurringIncomesAnalyticsResult {
  incomes: RecurringIncome[];
  monthlyTotal: number;
  projection: MonthCashProjection[];
  projectionTotal: number;
  isLoading: boolean;
  error: Error | null;
}

/** Income list + 3-month receipt projection for Pro incomes page. */
export function useRecurringIncomesAnalytics(): UseRecurringIncomesAnalyticsResult & {
  saveIncomesAsync: ReturnType<typeof useRecurringIncomes>["saveIncomesAsync"];
  deleteIncomeAsync: ReturnType<typeof useRecurringIncomes>["deleteIncomeAsync"];
  isSaving: boolean;
  isDeleting: boolean;
} {
  const query = useRecurringIncomes();

  const monthlyTotal = useMemo(
    () => sumMonthlyEquivalent(query.incomes),
    [query.incomes]
  );

  const projection = useMemo(
    () =>
      projectRecurringByMonth(
        query.incomes,
        (income) => income.source,
        3
      ),
    [query.incomes]
  );

  const projectionTotal = useMemo(
    () => sumProjectionTotal(projection),
    [projection]
  );

  return {
    incomes: query.incomes,
    monthlyTotal,
    projection,
    projectionTotal,
    isLoading: query.isLoading,
    error: query.error,
    saveIncomesAsync: query.saveIncomesAsync,
    deleteIncomeAsync: query.deleteIncomeAsync,
    isSaving: query.isSaving,
    isDeleting: query.isDeleting,
  };
}
