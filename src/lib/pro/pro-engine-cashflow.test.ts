import { describe, expect, it } from "vitest";
import {
  buildEngineProfileFromUser,
  buildProEngineCashFlowContext,
  buildProSummaryCashFlowMetrics,
  inferEffectiveStability,
} from "./pro-engine-cashflow";
import type { FinancialProfile } from "@/lib/types/financial";

describe("pro-engine-cashflow", () => {
  it("prefers recurring streams over snapshots", () => {
    const profile: FinancialProfile = {
      availableFunds: 10_000,
      monthlyIncome: 5_000,
      monthlyExpenses: 4_000,
      incomeStability: "stable",
      debts: [],
      recurringIncomes: [
        {
          id: "1",
          source: "Salary",
          amount: 40_000,
          frequency: "monthly",
          category: "salary",
          nextDate: "2026-06-15",
          createdAt: "2026-06-01",
        },
      ],
      recurringExpenses: [
        {
          id: "2",
          name: "Rent",
          amount: 15_000,
          frequency: "monthly",
          category: "housing",
          nextDate: "2026-06-01",
          createdAt: "2026-06-01",
        },
      ],
    };

    const ctx = buildProEngineCashFlowContext(profile);
    expect(ctx.monthlyIncome).toBe(40_000);
    expect(ctx.monthlyExpenses).toBe(15_000);
    expect(ctx.incomeFromRecurring).toBe(true);
  });

  it("detects projected deficit within 2-month horizon", () => {
    const profile: FinancialProfile = {
      availableFunds: 3_000,
      incomeStability: "stable",
      debts: [
        {
          id: "d1",
          creditor: "Loan",
          amount: 20_000,
          minimumPayment: 3_000,
          category: "loans",
        },
      ],
      recurringIncomes: [
        {
          id: "i1",
          source: "Job",
          amount: 10_000,
          frequency: "monthly",
          category: "salary",
          nextDate: "2026-06-01",
          createdAt: "2026-06-01",
        },
      ],
      recurringExpenses: [
        {
          id: "e1",
          name: "Living",
          amount: 9_000,
          frequency: "monthly",
          category: "food",
          nextDate: "2026-06-01",
          createdAt: "2026-06-01",
        },
      ],
    };

    const ctx = buildProEngineCashFlowContext(
      profile,
      new Date(2026, 5, 1)
    );
    expect(ctx.netMonthlyCashFlow).toBe(-2_000);
    expect(ctx.projectedDeficitMonthIndex).toBe(1);
    expect(ctx.shortTermForecast).toHaveLength(2);
    expect(ctx.planningAvailableFunds).toBe(4_000);
  });

  it("sets cash-flow buffer floor to 20% of positive net", () => {
    const profile: FinancialProfile = {
      availableFunds: 20_000,
      incomeStability: "stable",
      debts: [],
      recurringIncomes: [
        {
          id: "i1",
          source: "Job",
          amount: 50_000,
          frequency: "monthly",
          category: "salary",
          nextDate: "2026-06-01",
          createdAt: "2026-06-01",
        },
      ],
      recurringExpenses: [
        {
          id: "e1",
          name: "Living",
          amount: 30_000,
          frequency: "monthly",
          category: "food",
          nextDate: "2026-06-01",
          createdAt: "2026-06-01",
        },
      ],
    };

    const ctx = buildProEngineCashFlowContext(profile);
    expect(ctx.cashFlowBasedMinBuffer).toBe(4_000);
    expect(ctx.monthlyRecurringIncome).toBe(50_000);
    expect(ctx.monthlyRecurringExpense).toBe(30_000);
  });

  it("downgrades stability under sustained deficit", () => {
    expect(inferEffectiveStability("stable", 20_000, -5_000)).toBe("variable");
    expect(inferEffectiveStability("variable", 10_000, -3_000)).toBe("uncertain");
  });

  it("buildProSummaryCashFlowMetrics matches engine net with debt payments", () => {
    const profile = {
      userId: "u1",
      availableFunds: 10_000,
      currency: "CZK" as const,
      incomeStability: "stable" as const,
      subscriptionTier: "pro" as const,
      lastUpdated: "2026-06-01",
      debts: [
        {
          id: "d1",
          creditor: "Loan",
          amount: 20_000,
          minimumPayment: 5_000,
          category: "loans" as const,
        },
      ],
      recurringIncomes: [
        {
          id: "i1",
          source: "Job",
          amount: 30_000,
          frequency: "monthly" as const,
          category: "salary" as const,
          nextDate: "2026-06-01",
          createdAt: "2026-06-01",
        },
      ],
      recurringExpenses: [
        {
          id: "e1",
          name: "Living",
          amount: 20_000,
          frequency: "monthly" as const,
          category: "food" as const,
          nextDate: "2026-06-01",
          createdAt: "2026-06-01",
        },
      ],
    };

    const metrics = buildProSummaryCashFlowMetrics(profile);
    const ctx = buildProEngineCashFlowContext(buildEngineProfileFromUser(profile));

    expect(metrics.netMonthlyCashFlow).toBe(5_000);
    expect(metrics.netMonthlyCashFlow).toBe(ctx.netMonthlyCashFlow);
    expect(metrics.minimumDebtPayments).toBe(5_000);
    expect(metrics.monthlyRecurringIncome).toBe(30_000);
    expect(metrics.monthlyRecurringExpense).toBe(20_000);
  });
});
