import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import { saveOfflineRecommendation } from "@/lib/offline/storage";
import { emitRecommendationSaved } from "@/lib/pwa/events";
import type { Locale } from "@/i18n/routing";

/** Uloží doporučení do IndexedDB pro offline režim a install prompt */
export async function persistRecommendationOffline(
  locale: Locale,
  profile: FinancialProfile,
  result: PrioritizationResult,
  source: "chat" | "manual"
): Promise<void> {
  await saveOfflineRecommendation({
    locale,
    result,
    profile,
    savedAt: new Date().toISOString(),
    source,
  });
  emitRecommendationSaved();
}
