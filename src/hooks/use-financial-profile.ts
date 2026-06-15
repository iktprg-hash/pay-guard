"use client";

import { useCallback, useState } from "react";
import { mergeProfileUpdate } from "@/lib/financial/profile-merge";
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
    setProfile((prev) => mergeProfileUpdate(prev, update));
  }, []);

  const setProfileFull = useCallback((next: FinancialProfile) => {
    setProfile(next);
  }, []);

  const reset = useCallback(() => setProfile(EMPTY_PROFILE), []);

  const isReady =
    profile.debts.length > 0 && profile.availableFunds > 0;

  return { profile, mergeProfile, setProfile: setProfileFull, reset, isReady };
}
