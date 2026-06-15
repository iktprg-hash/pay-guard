"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubscriptionTier } from "@/lib/types/financial";
import { isProEnabledForSubscription } from "@/lib/supabase/pro-access";

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
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTier = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/tier", { credentials: "include" });
      if (!res.ok) {
        setTier("free");
        setExpiresAt(null);
        return;
      }

      const data = (await res.json()) as {
        tier?: SubscriptionTier;
        pro?: boolean;
        expiresAt?: string | null;
      };

      const nextTier =
        data.tier === "pro_max"
          ? "pro_max"
          : data.tier === "pro"
            ? "pro"
            : "free";

      setTier(nextTier);
      setExpiresAt(data.expiresAt ?? null);
    } catch {
      setTier("free");
      setExpiresAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTier();
  }, [fetchTier]);

  const isProEnabled = isProEnabledForSubscription(tier, expiresAt);

  return {
    tier,
    subscriptionTier: tier,
    pro: isProEnabled,
    isProEnabled,
    expiresAt,
    loading,
    refetch: fetchTier,
  };
}
