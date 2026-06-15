import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import { saveOfflineRecommendation } from "@/lib/offline/storage";
import { emitRecommendationSaved } from "@/lib/pwa/events";
import type { Locale } from "@/i18n/routing";

export type RecommendationSource = "chat" | "manual";

export interface PersistRecommendationOfflineOptions {
  locale: Locale;
  profile: FinancialProfile;
  recommendation: PrioritizationResult;
  source: RecommendationSource;
}

/**
 * Persist a prioritization result to IndexedDB for offline PWA access.
 * Emits a client event so install/offline UI can react.
 */
export async function persistRecommendationOffline(
  locale: Locale,
  profile: FinancialProfile,
  recommendation: PrioritizationResult,
  source: RecommendationSource
): Promise<void> {
  try {
    await saveOfflineRecommendation({
      locale,
      result: recommendation,
      profile,
      savedAt: new Date().toISOString(),
      source,
    });
    emitRecommendationSaved();
  } catch (error) {
    console.error("[persistRecommendationOffline]", error);
    throw error;
  }
}

/** Object-form alias for callers that prefer a single argument. */
export async function persistRecommendationOfflineFromOptions(
  options: PersistRecommendationOfflineOptions
): Promise<void> {
  const { locale, profile, recommendation, source } = options;
  return persistRecommendationOffline(locale, profile, recommendation, source);
}
