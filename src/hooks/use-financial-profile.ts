"use client";

import { useCallback, useState } from "react";
import type { FinancialProfile } from "@/lib/types/financial";

const EMPTY_PROFILE: FinancialProfile = {
  availableFunds: 0,
  debts: [],
};

/** Správa finančního profilu v chatu / ručním režimu */
export function useFinancialProfile(initial?: Partial<FinancialProfile>) {
  const [profile, setProfile] = useState<FinancialProfile>({
    ...EMPTY_PROFILE,
    ...initial,
  });

  const mergeProfile = useCallback((update: Partial<FinancialProfile>) => {
    setProfile((prev) => ({
      availableFunds: update.availableFunds ?? prev.availableFunds,
      monthlyIncome: update.monthlyIncome ?? prev.monthlyIncome,
      monthlyExpenses: update.monthlyExpenses ?? prev.monthlyExpenses,
      incomeStability: update.incomeStability ?? prev.incomeStability,
      debts:
        update.debts && update.debts.length > 0 ? update.debts : prev.debts,
    }));
  }, []);

  const reset = useCallback(() => setProfile(EMPTY_PROFILE), []);

  const isReady =
    profile.debts.length > 0 && profile.availableFunds > 0;

  return { profile, mergeProfile, reset, isReady };
}
