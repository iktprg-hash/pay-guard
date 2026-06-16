"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { SubscriptionTier } from "@/lib/types/financial";
import { isProEnabledForSubscription } from "@/lib/supabase/pro-access";
import { usePageVisible } from "@/hooks/use-page-visible";

export const subscriptionTierKeys = {
  all: ["subscription-tier"] as const,
};

const TIER_STALE_MS = 30_000;
const TIER_REFETCH_INTERVAL_MS = 120_000;

interface SubscriptionTierData {
  tier: SubscriptionTier;
  expiresAt: string | null;
}

async function fetchSubscriptionTier(): Promise<SubscriptionTierData> {
  const res = await fetch("/api/auth/tier", { credentials: "include" });

  if (!res.ok) {
    return { tier: "free", expiresAt: null };
  }

  const data = (await res.json()) as {
    tier?: SubscriptionTier;
    expiresAt?: string | null;
  };

  const tier =
    data.tier === "pro_max" ? "pro_max" : data.tier === "pro" ? "pro" : "free";

  return { tier, expiresAt: data.expiresAt ?? null };
}

/** Invalidate TanStack Query cache after webhook/checkout subscription changes. */
export function invalidateSubscriptionTier(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: subscriptionTierKeys.all });
}

/** Optimistic Pro tier — unlocks ProFeatureGate before refetch completes. */
export function setOptimisticSubscriptionTier(
  queryClient: QueryClient,
  tier: SubscriptionTier = "pro",
  expiresAt: string | null = null
): void {
  queryClient.setQueryData<SubscriptionTierData>(subscriptionTierKeys.all, {
    tier,
    expiresAt,
  });
}

/** After successful checkout confirm — instant UI unlock + background refetch. */
export function applyCheckoutSubscriptionUpdate(
  queryClient: QueryClient,
  tier: SubscriptionTier = "pro",
  expiresAt: string | null = null
): void {
  setOptimisticSubscriptionTier(queryClient, tier, expiresAt);
  invalidateSubscriptionTier(queryClient);
}

/** Single source of truth for Pro subscription status (Stripe-backed). */
export interface ProAccessState {
  tier: SubscriptionTier;
  subscriptionTier: SubscriptionTier;
  /** @deprecated Use isProEnabled */
  pro: boolean;
  isProEnabled: boolean;
  expiresAt: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/** @deprecated Use ProAccessState */
export type SubscriptionTierState = ProAccessState;

/** Load subscription tier from /api/auth/tier — canonical Pro access hook. */
export function useProAccess(): ProAccessState {
  const pageVisible = usePageVisible();

  const query = useQuery({
    queryKey: subscriptionTierKeys.all,
    queryFn: fetchSubscriptionTier,
    staleTime: TIER_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: pageVisible ? TIER_REFETCH_INTERVAL_MS : false,
  });

  const tier = query.data?.tier ?? "free";
  const expiresAt = query.data?.expiresAt ?? null;
  const isProEnabled = isProEnabledForSubscription(tier, expiresAt);

  return {
    tier,
    subscriptionTier: tier,
    pro: isProEnabled,
    isProEnabled,
    expiresAt,
    loading: query.isLoading,
    refetch: async () => {
      await query.refetch();
    },
  };
}

/** Hook for components that need to bust subscription cache (e.g. after checkout). */
export function useInvalidateSubscriptionTier(): () => void {
  const queryClient = useQueryClient();
  return () => invalidateSubscriptionTier(queryClient);
}
