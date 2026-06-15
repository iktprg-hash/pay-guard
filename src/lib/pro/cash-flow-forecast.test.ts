import { describe, expect, it } from "vitest";
import { buildCashFlowForecast } from "./cash-flow-forecast";
import type { ProFinancialSummary } from "@/hooks/useProFinancial";

function baseSummary(
  overrides: Partial<ProFinancialSummary> = {}
): ProFinancialSummary {
  return {
    profile: undefined,
    currency: "CZK",
    availableFunds: 10_000,
    totalDebtAmount: 0,
    minimumPaymentsDue: 0,
    debtCount: 0,
    criticalDebts: [],
    urgentDebts: [],
    monthlyRecurringIncome: 30_000,
    monthlyRecurringExpense: 20_000,
    resolvedMonthlyIncome: 30_000,
    resolvedMonthlyExpenses: 20_000,
    netMonthlyCashFlow: 10_000,
    projectedDeficitMonthIndex: null,
    shortTermForecast: [],
    planningAvailableFunds: 10_000,
    subscriptionTier: "pro",
    ...overrides,
  };
}

describe("buildCashFlowForecast", () => {
  it("projects 3 months with compound balance", () => {
    const result = buildCashFlowForecast(
      baseSummary({
        minimumPaymentsDue: 5_000,
        netMonthlyCashFlow: 5_000,
      }),
      3,
      new Date(2026, 5, 15)
    );

    expect(result.months).toHaveLength(3);
    expect(result.netMonthlyChange).toBe(5_000);
    expect(result.months[0].endingBalance).toBe(15_000);
    expect(result.months[2].endingBalance).toBe(25_000);
    expect(result.months[0].yearMonth).toBe("2026-06");
    expect(result.months[2].yearMonth).toBe("2026-08");
  });

  it("flags deficit recommendations", () => {
    const result = buildCashFlowForecast(
      baseSummary({
        availableFunds: 2_000,
        monthlyRecurringIncome: 10_000,
        monthlyRecurringExpense: 12_000,
        resolvedMonthlyIncome: 10_000,
        resolvedMonthlyExpenses: 12_000,
        minimumPaymentsDue: 3_000,
        netMonthlyCashFlow: -5_000,
        projectedDeficitMonthIndex: 0,
      })
    );

    expect(result.months[0].isDeficit).toBe(true);
    expect(result.recommendations.some((r) => r.kind === "monthly_deficit")).toBe(
      true
    );
    expect(
      result.recommendations.some((r) => r.kind === "projected_deficit")
    ).toBe(true);
  });
});
