import type { Locale } from "@/i18n/routing";
import { persistRecommendationOffline } from "@/lib/pwa/persistRecommendationOffline";
import type {
  FinancialProfile,
  PrioritizationResult,
} from "@/lib/types/financial";
import type { RecommendationSource } from "@/lib/pwa/persistRecommendationOffline";

export interface PersistChatRecommendationOptions {
  locale: Locale;
  profile: FinancialProfile;
  recommendation: PrioritizationResult;
  source?: RecommendationSource;
  isProEnabled?: boolean;
  persistRecommendationToPro?: (
    profile: FinancialProfile,
    recommendation: PrioritizationResult
  ) => Promise<void>;
}

/**
 * Save a chat/manual recommendation offline and optionally to Pro cloud.
 * Offline persistence runs first; Pro sync is best-effort when enabled.
 */
export async function persistChatRecommendation({
  locale,
  profile,
  recommendation,
  source = "chat",
  isProEnabled = false,
  persistRecommendationToPro,
}: PersistChatRecommendationOptions): Promise<void> {
  await persistRecommendationOffline(locale, profile, recommendation, source);

  if (isProEnabled && persistRecommendationToPro) {
    try {
      await persistRecommendationToPro(profile, recommendation);
    } catch (error) {
      console.error("[persistChatRecommendation] Pro sync failed", error);
    }
  }
}
