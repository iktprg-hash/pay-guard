import type { ProFinancialSummary } from "@/hooks/useProFinancial";

export const DEFAULT_FORECAST_MONTHS = 3;

export interface ForecastMonth {
  index: number;
  /** ISO year-month, e.g. 2026-06 */
  yearMonth: string;
  startingBalance: number;
  income: number;
  expenses: number;
  debtPayments: number;
  netChange: number;
  endingBalance: number;
  isDeficit: boolean;
}

export type ForecastRecommendationKind =
  | "monthly_deficit"
  | "projected_deficit"
  | "critical_debts"
  | "urgent_debts"
  | "stable_outlook";

export interface ForecastRecommendation {
  kind: ForecastRecommendationKind;
  monthIndex?: number;
  amount?: number;
  count?: number;
}

export interface CashFlowForecastResult {
  months: ForecastMonth[];
  /** income − recurring expenses − minimum debt payments */
  netMonthlyChange: number;
  hasData: boolean;
  recommendations: ForecastRecommendation[];
  chartScaleMax: number;
}

function addMonths(base: Date, offset: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

function yearMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildRecommendations(
  summary: ProFinancialSummary,
  months: ForecastMonth[]
): ForecastRecommendation[] {
  const recs: ForecastRecommendation[] = [];

  if (months[0]?.isDeficit) {
    recs.push({
      kind: "monthly_deficit",
      amount: Math.abs(months[0].netChange),
    });
  }

  for (const month of months) {
    if (month.endingBalance < 0) {
      recs.push({
        kind: "projected_deficit",
        monthIndex: month.index,
        amount: Math.abs(month.endingBalance),
      });
      break;
    }
  }

  if (summary.criticalDebts.length > 0) {
    recs.push({
      kind: "critical_debts",
      count: summary.criticalDebts.length,
    });
  }

  const urgentOnly = summary.urgentDebts.length - summary.criticalDebts.length;
  if (urgentOnly > 0) {
    recs.push({
      kind: "urgent_debts",
      count: urgentOnly,
    });
  }

  if (
    recs.length === 0 &&
    months.length > 0 &&
    months.every((m) => m.endingBalance >= 0)
  ) {
    recs.push({ kind: "stable_outlook" });
  }

  return recs;
}

/**
 * Build a multi-month cash flow projection from Pro financial summary.
 * Uses the same net formula as Priority Engine ({@link buildProSummaryCashFlowMetrics}).
 */
export function buildCashFlowForecast(
  summary: ProFinancialSummary,
  monthCount: number = DEFAULT_FORECAST_MONTHS,
  now: Date = new Date()
): CashFlowForecastResult {
  const income = summary.resolvedMonthlyIncome;
  const expenses = summary.resolvedMonthlyExpenses;
  const debtPayments = summary.minimumPaymentsDue;
  const netMonthlyChange = summary.netMonthlyCashFlow;

  const hasData =
    summary.debtCount > 0 ||
    income > 0 ||
    expenses > 0 ||
    summary.availableFunds !== 0;

  const months: ForecastMonth[] = [];
  let balance = summary.availableFunds;

  for (let i = 0; i < monthCount; i++) {
    const startingBalance = balance;
    const endingBalance = startingBalance + netMonthlyChange;

    months.push({
      index: i,
      yearMonth: yearMonthKey(addMonths(now, i)),
      startingBalance,
      income,
      expenses,
      debtPayments,
      netChange: netMonthlyChange,
      endingBalance,
      isDeficit: netMonthlyChange < 0,
    });

    balance = endingBalance;
  }

  const chartScaleMax = Math.max(
    ...months.map((m) => Math.abs(m.endingBalance)),
    Math.abs(summary.availableFunds),
    1
  );

  return {
    months,
    netMonthlyChange,
    hasData,
    recommendations: buildRecommendations(summary, months),
    chartScaleMax,
  };
}
