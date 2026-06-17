import { apiFetch } from "@/lib/api/client-fetch";
import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";
import { runPriorityEngine } from "@/services/priorityEngine";

export function isOfflineEnvironment(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * Run prioritization locally when offline, otherwise POST to /api/prioritize.
 */
export async function resolvePrioritization(
  profile: FinancialProfile,
  locale: Locale
): Promise<PrioritizationResult> {
  if (isOfflineEnvironment()) {
    return runPriorityEngine(profile, locale);
  }

  return apiFetch<PrioritizationResult>("/api/prioritize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profile, locale }),
    locale,
  });
}
