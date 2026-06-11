import type { FinancialProfile } from "@/lib/types/financial";

/** Reduces PII sent to xAI — keeps fields needed for advice, drops free-text notes */
export function minimizeProfileForGrok(profile: FinancialProfile): FinancialProfile {
  return {
    availableFunds: profile.availableFunds,
    monthlyIncome: profile.monthlyIncome,
    monthlyExpenses: profile.monthlyExpenses,
    incomeStability: profile.incomeStability,
    debts: profile.debts.map(({ notes: _notes, criticalNote: _criticalNote, ...debt }) => debt),
  };
}
