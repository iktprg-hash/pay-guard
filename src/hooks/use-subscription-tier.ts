"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { SubscriptionTier } from "@/lib/types/financial";
import { isProEnabledForSubscription } from "@/lib/supabase/pro-access";

export const subscriptionTierKeys = {
  all: ["subscription-tier"] as const,
};

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

export interface SubscriptionTierState {
  tier: SubscriptionTier;
  subscriptionTier: SubscriptionTier;
  /** @deprecated Use isProEnabled */
  pro: boolean;
  isProEnabled: boolean;
  expiresAt: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/** Load subscription tier from /api/auth/tier (Stripe-backed profiles). */
export function useSubscriptionTier(): SubscriptionTierState {
  const query = useQuery({
    queryKey: subscriptionTierKeys.all,
    queryFn: fetchSubscriptionTier,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
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
