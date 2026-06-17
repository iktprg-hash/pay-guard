import { runPriorityEngine } from "@/services/priorityEngine";
import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";
import { appErrorFromResponse, getUserFriendlyMessage } from "@/lib/errors";

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

  const res = await fetch("/api/prioritize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profile, locale }),
  });

  if (!res.ok) {
    const appError = await appErrorFromResponse(res, locale);
    throw new Error(getUserFriendlyMessage(appError, locale));
  }

  return res.json() as Promise<PrioritizationResult>;
}
