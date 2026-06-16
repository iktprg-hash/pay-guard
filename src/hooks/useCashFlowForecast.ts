"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateProCatalogSync,
  useProFinancialSummary,
  type UseProFinancialSummaryResult,
} from "@/hooks/useProFinancial";
import { useAuth } from "@/components/providers/auth-provider";
import {
  buildCashFlowForecast,
  DEFAULT_FORECAST_MONTHS,
  type CashFlowForecastResult,
} from "@/lib/pro/cash-flow-forecast";

export interface UseCashFlowForecastResult extends UseProFinancialSummaryResult {
  forecast: CashFlowForecastResult;
}

/** 3-month cash flow forecast derived from {@link useProFinancialSummary}. */
export function useCashFlowForecast(
  monthCount: number = DEFAULT_FORECAST_MONTHS
): UseCashFlowForecastResult {
  const query = useProFinancialSummary();

  const forecast = useMemo(
    () => buildCashFlowForecast(query.summary, monthCount),
    [query.summary, monthCount]
  );

  return { ...query, forecast };
}

/** Invalidate profile + catalog so Dashboard and Forecast refresh together. */
export function useInvalidateCashFlowForecast() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useCallback(() => {
    if (!user?.id) return;
    invalidateProCatalogSync(queryClient, user.id);
  }, [queryClient, user?.id]);
}
