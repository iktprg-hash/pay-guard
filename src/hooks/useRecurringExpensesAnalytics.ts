"use client";

import { useMemo } from "react";
import { useRecurringExpenses } from "@/hooks/useProFinancial";
import type { RecurringExpense } from "@/lib/types/financial";
import {
  groupByCategoryMonthly,
  sumMonthlyEquivalent,
  type CategoryTotal,
} from "@/lib/pro/recurring-projection";

export interface UseRecurringExpensesAnalyticsResult {
  expenses: RecurringExpense[];
  monthlyTotal: number;
  byCategory: CategoryTotal[];
  isLoading: boolean;
  error: Error | null;
}

/** Expense list + category totals for Pro expenses page. */
export function useRecurringExpensesAnalytics(): UseRecurringExpensesAnalyticsResult & {
  saveExpensesAsync: ReturnType<typeof useRecurringExpenses>["saveExpensesAsync"];
  deleteExpenseAsync: ReturnType<typeof useRecurringExpenses>["deleteExpenseAsync"];
  isSaving: boolean;
  isDeleting: boolean;
} {
  const query = useRecurringExpenses();

  const monthlyTotal = useMemo(
    () => sumMonthlyEquivalent(query.expenses),
    [query.expenses]
  );

  const byCategory = useMemo(
    () => groupByCategoryMonthly(query.expenses),
    [query.expenses]
  );

  return {
    expenses: query.expenses,
    monthlyTotal,
    byCategory,
    isLoading: query.isLoading,
    error: query.error,
    saveExpensesAsync: query.saveExpensesAsync,
    deleteExpenseAsync: query.deleteExpenseAsync,
    isSaving: query.isSaving,
    isDeleting: query.isDeleting,
  };
}
