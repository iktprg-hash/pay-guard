import {
  isPaidTier,
  type SubscriptionTier,
} from "@/lib/types/financial";

/** Client-safe Pro check (mirrors server isActivePro). */
export function isActiveProSubscription(
  tier: SubscriptionTier,
  expiresAt?: string | null
): boolean {
  if (!isPaidTier(tier)) return false;
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}

export const PRO_REQUIRED_ERROR = "PRO_REQUIRED";

/** Whether the user has an active paid subscription (Pro / Pro Max). */
export function isProEnabledForSubscription(
  tier: SubscriptionTier,
  expiresAt?: string | null
): boolean {
  return isActiveProSubscription(tier, expiresAt);
}

/** Whether profile metadata grants Pro access (client-side guard). */
export function isProEnabledForProfile(profile: {
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt?: string | null;
}): boolean {
  return isProEnabledForSubscription(
    profile.subscriptionTier,
    profile.subscriptionExpiresAt
  );
}

/** Human-readable plan label key segment for i18n `pro.tier.*` */
export function subscriptionTierLabel(tier: SubscriptionTier): SubscriptionTier {
  return isPaidTier(tier) ? tier : "free";
}
