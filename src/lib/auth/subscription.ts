import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/lib/types/financial";
import { isPaidTier } from "@/lib/types/financial";

export interface UserSubscription {
  tier: SubscriptionTier;
  expiresAt: string | null;
}

/** Je aktivní Pro / Pro Max předplatné? */
export function isActivePro(subscription: UserSubscription): boolean {
  if (!isPaidTier(subscription.tier)) return false;
  if (!subscription.expiresAt) return false;
  return new Date(subscription.expiresAt) > new Date();
}

/** Načte tier z profiles — default free */
export async function getUserSubscription(
  userId: string
): Promise<UserSubscription> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("subscription_tier, subscription_expires_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return { tier: "free", expiresAt: null };
    }

    const rawTier = data.subscription_tier;
    const tier: SubscriptionTier =
      rawTier === "pro_max"
        ? "pro_max"
        : rawTier === "pro"
          ? "pro"
          : "free";

    return {
      tier,
      expiresAt: data.subscription_expires_at ?? null,
    };
  } catch {
    return { tier: "free", expiresAt: null };
  }
}

export async function userHasProAccess(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return isActivePro(subscription);
}
