import { describe, expect, it } from "vitest";
import {
  APP_CURRENCIES,
  DEBT_CATEGORIES,
  DEFAULT_APP_CURRENCY,
  EXPENSE_CATEGORIES,
  createEmptyUserFinancialProfile,
  isPaidTier,
  mergeFinancialProfiles,
  mergeProfileUpdate,
  toFinancialProfile,
} from "@/lib/types/financial";

describe("financial types", () => {
  it("exports category constants aligned with unions", () => {
    expect(DEBT_CATEGORIES).toContain("transport");
    expect(DEBT_CATEGORIES).toContain("subscriptions");
    expect(EXPENSE_CATEGORIES).toContain("health");
    expect(APP_CURRENCIES).toEqual(["CZK", "RUB"]);
    expect(DEFAULT_APP_CURRENCY).toBe("CZK");
  });

  it("isPaidTier covers pro and pro_max", () => {
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("pro_max")).toBe(true);
  });

  it("createEmptyUserFinancialProfile defaults to CZK and free tier", () => {
    const profile = createEmptyUserFinancialProfile("user-1");
    expect(profile.userId).toBe("user-1");
    expect(profile.currency).toBe("CZK");
    expect(profile.subscriptionTier).toBe("free");
    expect(profile.debts).toEqual([]);
    expect(profile.recurringIncomes).toEqual([]);
    expect(profile.recurringExpenses).toEqual([]);
  });

  it("toFinancialProfile strips Pro-only fields", () => {
    const pro = createEmptyUserFinancialProfile("u1", "pro");
    pro.availableFunds = 5000;
    pro.monthlyIncome = 30000;
    pro.debts = [{ id: "d1", creditor: "Rent", amount: 12000, category: "housing" }];

    expect(toFinancialProfile(pro)).toEqual({
      availableFunds: 5000,
      monthlyIncome: 30000,
      monthlyExpenses: undefined,
      incomeStability: undefined,
      debts: pro.debts,
      recurringIncomes: [],
      recurringExpenses: [],
    });
  });

  it("mergeProfileUpdate merges debts without replacing the full list", () => {
    const current = toFinancialProfile(createEmptyUserFinancialProfile("u1"));
    current.availableFunds = 10000;
    current.debts = [{ id: "d1", creditor: "Rent", amount: 12000, category: "housing" }];

    const merged = mergeProfileUpdate(current, {
      availableFunds: 8000,
      debts: [{ id: "d2", creditor: "Energy", amount: 2000, category: "utilities" }],
    });

    expect(merged.availableFunds).toBe(8000);
    expect(merged.debts).toHaveLength(2);
    expect(merged.debts.map((d) => d.creditor)).toContain("Rent");
    expect(merged.debts.map((d) => d.creditor)).toContain("Energy");
  });

  it("mergeFinancialProfiles prefers pro debts when non-empty", () => {
    const base = toFinancialProfile(createEmptyUserFinancialProfile("u1"));
    const merged = mergeFinancialProfiles(base, {
      availableFunds: 8000,
      debts: [{ id: "d2", creditor: "Energy", amount: 2000, category: "utilities" }],
      recurringIncomes: [{ id: "i1", source: "Salary", amount: 40000, frequency: "monthly", nextDate: "2026-07-01", createdAt: "2026-06-01T00:00:00.000Z" }],
      recurringExpenses: [],
    });

    expect(merged.availableFunds).toBe(8000);
    expect(merged.debts[0]?.creditor).toBe("Energy");
    expect(merged.recurringIncomes).toHaveLength(1);
  });
});
