import type { ForecastMonth } from "@/lib/pro/cash-flow-forecast";

export type ForecastConclusionKind =
  | "projected_deficit"
  | "monthly_deficit"
  | "stable_positive";

export interface ForecastConclusion {
  kind: ForecastConclusionKind;
  amount: number;
  monthIndex?: number;
}

/** Plain-language forecast takeaway for Dashboard and Forecast pages. */
export function buildForecastConclusion(
  months: ForecastMonth[],
  netMonthlyChange: number
): ForecastConclusion | null {
  if (months.length === 0) return null;

  const deficitMonth = months.find((m) => m.endingBalance < 0);
  if (deficitMonth) {
    return {
      kind: "projected_deficit",
      amount: Math.abs(deficitMonth.endingBalance),
      monthIndex: deficitMonth.index,
    };
  }

  if (netMonthlyChange < 0) {
    return {
      kind: "monthly_deficit",
      amount: Math.abs(netMonthlyChange),
    };
  }

  const lastMonth = months[months.length - 1]!;
  return {
    kind: "stable_positive",
    amount: lastMonth.endingBalance,
    monthIndex: lastMonth.index,
  };
}
