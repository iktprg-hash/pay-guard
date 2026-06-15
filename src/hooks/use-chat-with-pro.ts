"use client";

/**
 * Bridges the chat financial profile with Pay Guard Pro cloud catalog.
 *
 * - Auto-loads Pro profile into an empty chat (Pro subscribers)
 * - Saves debts catalog + financial session after recommendations
 * - Manual save/load controls for the chat toolbar
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { useNetworkStatus } from "@/components/pwa/NetworkProvider";
import { toast } from "@/components/ui/toast-provider";
import {
  useCreateFinancialSession,
  useDebts,
  useRecurringExpenses,
  useRecurringIncomes,
  useUserFinancialProfile,
} from "@/hooks/useProFinancial";
import { useProAccess } from "@/hooks/use-pro-access";
import type { Locale } from "@/i18n/routing";
import {
  isPaidTier,
  toFinancialProfile,
  type FinancialProfile,
  type PrioritizationResult,
} from "@/lib/types/financial";

export type ProSyncStatus = "idle" | "syncing" | "synced" | "failed";

export interface UseChatWithProOptions {
  locale: Locale;
  profile: FinancialProfile;
  setProfile: (profile: FinancialProfile) => void;
  /** Chat finished hydrating local storage. */
  chatHydrated?: boolean;
  /** No messages in the current chat yet. */
  isEmpty?: boolean;
  /** Auto-merge Pro cloud profile when chat is empty (default true). */
  autoLoadWhenEmpty?: boolean;
}

export interface UseChatWithProResult {
  isProEnabled: boolean;
  isProLoading: boolean;
  isOnline: boolean;
  syncStatus: ProSyncStatus;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  loadFromPro: () => Promise<void>;
  saveToPro: (profile?: FinancialProfile) => Promise<void>;
  persistRecommendationToPro: (
    profile: FinancialProfile,
    recommendation: PrioritizationResult
  ) => Promise<void>;
}

export function useChatWithPro({
  locale,
  profile,
  setProfile,
  chatHydrated = false,
  isEmpty = false,
  autoLoadWhenEmpty = true,
}: UseChatWithProOptions): UseChatWithProResult {
  const t = useTranslations("chat.pro");
  const { user, loading: authLoading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { isProEnabled: hasProApi, loading: tierLoading } = useProAccess();

  const proProfileQuery = useUserFinancialProfile();
  const { saveDebtsAsync, isSaving: isSavingDebts } = useDebts({
    showErrorToast: false,
    fetchEnabled: false,
  });
  const { saveIncomesAsync, isSaving: isSavingIncomes } = useRecurringIncomes({
    showErrorToast: false,
    fetchEnabled: false,
  });
  const { saveExpensesAsync, isSaving: isSavingExpenses } =
    useRecurringExpenses({ showErrorToast: false, fetchEnabled: false });
  const { createSessionAsync, isCreating: isCreatingSession } =
    useCreateFinancialSession({ showErrorToast: false });

  const [syncStatus, setSyncStatus] = useState<ProSyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const autoLoadedRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  const proProfile = proProfileQuery.data;
  const isProEnabled =
    Boolean(user) &&
    !authLoading &&
    (hasProApi || (proProfile ? isPaidTier(proProfile.subscriptionTier) : false));

  const isProLoading =
    tierLoading || (isProEnabled && proProfileQuery.isLoading);

  const isSyncing =
    syncStatus === "syncing" ||
    isSavingDebts ||
    isSavingIncomes ||
    isSavingExpenses ||
    isCreatingSession;

  const markSynced = useCallback(() => {
    setSyncStatus("synced");
    setLastSyncedAt(new Date());
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setSyncStatus("idle");
    }, 5000);
  }, []);

  const markFailed = useCallback(() => {
    setSyncStatus("failed");
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  /** Push chat debts (+ keep catalog incomes/expenses) to Pro cloud. */
  const saveToPro = useCallback(
    async (profileToSave: FinancialProfile = profile) => {
      if (!isProEnabled) return;
      if (!isOnline) {
        toast(t("offlineHint"), "default");
        return;
      }
      setSyncStatus("syncing");
      try {
        await saveDebtsAsync(profileToSave.debts);
        if (proProfile?.recurringIncomes.length) {
          await saveIncomesAsync(proProfile.recurringIncomes);
        }
        if (proProfile?.recurringExpenses.length) {
          await saveExpensesAsync(proProfile.recurringExpenses);
        }
        markSynced();
        toast(t("saveSuccess"), "success");
      } catch (error) {
        markFailed();
        toast(
          error instanceof Error ? error.message : t("saveFailed"),
          "error"
        );
        throw error;
      }
    },
    [
      isProEnabled,
      isOnline,
      profile,
      proProfile,
      saveDebtsAsync,
      saveIncomesAsync,
      saveExpensesAsync,
      markSynced,
      markFailed,
      t,
    ]
  );

  /** Merge Pro cloud profile into the active chat profile. */
  const loadFromPro = useCallback(async () => {
    if (!isProEnabled) return;
    if (!isOnline) {
      toast(t("offlineHint"), "default");
      return;
    }
    setSyncStatus("syncing");
    try {
      const result = await proProfileQuery.refetch();
      const data = result.data ?? proProfile;
      if (!data) throw new Error(t("loadFailed"));
      setProfile(toFinancialProfile(data));
      markSynced();
      toast(t("loadSuccess"), "success");
    } catch (error) {
      markFailed();
      toast(
        error instanceof Error ? error.message : t("loadFailed"),
        "error"
      );
      throw error;
    }
  }, [
    isProEnabled,
    isOnline,
    proProfileQuery,
    proProfile,
    setProfile,
    markSynced,
    markFailed,
    t,
  ]);

  /** After a recommendation: sync catalog + persist prioritization session. */
  const persistRecommendationToPro = useCallback(
    async (
      sessionProfile: FinancialProfile,
      recommendation: PrioritizationResult
    ) => {
      if (!isProEnabled) return;
      if (!isOnline) return;
      setSyncStatus("syncing");
      try {
        await saveDebtsAsync(sessionProfile.debts);
        await createSessionAsync({
          profile: sessionProfile,
          recommendation,
          options: {
            source: "chat",
            locale,
            title: t("sessionTitle"),
          },
        });
        markSynced();
      } catch (error) {
        markFailed();
        console.error("[useChatWithPro] persistRecommendation", error);
        toast(t("sessionFailed"), "error");
      }
    },
    [
      isProEnabled,
      isOnline,
      saveDebtsAsync,
      createSessionAsync,
      locale,
      markSynced,
      markFailed,
      t,
    ]
  );

  /** Auto-load Pro profile into an empty new chat (once per mount). */
  useEffect(() => {
    if (
      !isProEnabled ||
      !isOnline ||
      !autoLoadWhenEmpty ||
      !chatHydrated ||
      !isEmpty ||
      autoLoadedRef.current ||
      proProfileQuery.isLoading
    ) {
      return;
    }

    const data = proProfileQuery.data;
    if (!data) return;

    const hasProData =
      data.debts.length > 0 ||
      data.availableFunds > 0 ||
      data.recurringIncomes.length > 0 ||
      data.recurringExpenses.length > 0;

    if (!hasProData) return;

    autoLoadedRef.current = true;
    setProfile(toFinancialProfile(data));
    markSynced();
  }, [
    isProEnabled,
    isOnline,
    autoLoadWhenEmpty,
    chatHydrated,
    isEmpty,
    proProfileQuery.isLoading,
    proProfileQuery.data,
    setProfile,
    markSynced,
  ]);

  return {
    isProEnabled,
    isProLoading,
    isOnline,
    syncStatus,
    isSyncing,
    lastSyncedAt,
    loadFromPro,
    saveToPro,
    persistRecommendationToPro,
  };
}
