"use client";

import { useMemo } from "react";
import {
  useProFinancialSummary,
  type UseProFinancialSummaryResult,
} from "@/hooks/useProFinancial";
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
