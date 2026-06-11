import type { Locale } from "@/i18n/routing";
import {
  loadOfflineRecommendation,
  loadOfflineSession,
  type OfflineRecommendationSnapshot,
  type OfflineSessionSnapshot,
} from "@/lib/offline/storage";
import {
  deserializeMessages,
  loadLocalHistory,
  serializeMessages,
} from "@/lib/chat/storage";
import type { ChatMessage, FinancialProfile } from "@/lib/types/financial";

export interface CacheFirstSessionResult {
  sessionId: string;
  messages: ChatMessage[];
  profile: FinancialProfile;
  source: "idb-session" | "local-storage" | "none";
}

/**
 * Cache-first: read offline recommendation from IndexedDB (encrypted).
 * No network round-trip — used when offline or as instant UI hydration.
 */
export async function loadRecommendationCacheFirst(
  locale: Locale
): Promise<OfflineRecommendationSnapshot | null> {
  return loadOfflineRecommendation(locale);
}

/**
 * Cache-first: last session from IDB backup, then localStorage history.
 * Enables opening the last conversation without network.
 */
export async function loadSessionCacheFirst(
  locale: Locale,
  sessionId?: string
): Promise<CacheFirstSessionResult | null> {
  const offline = await loadOfflineSession(locale);
  if (offline?.session) {
    const match =
      !sessionId || offline.session.sessionId === sessionId;
    if (match) {
      return {
        sessionId: offline.session.sessionId,
        messages: deserializeMessages(offline.session.messages),
        profile: offline.session.profile,
        source: "idb-session",
      };
    }
  }

  const local = await loadLocalHistory(locale, sessionId);
  if (local) {
    return {
      sessionId: local.sessionId,
      messages: local.messages,
      profile: local.profile,
      source: "local-storage",
    };
  }

  return null;
}

/** Snapshot for offline panel UI */
export async function loadOfflineBundleCacheFirst(locale: Locale) {
  const [recommendation, sessionResult] = await Promise.all([
    loadRecommendationCacheFirst(locale),
    loadSessionCacheFirst(locale),
  ]);

  let session: OfflineSessionSnapshot | null = null;
  if (sessionResult) {
    session = {
      session: {
        sessionId: sessionResult.sessionId,
        sessionToken: "",
        locale,
        messages: serializeMessages(sessionResult.messages),
        profile: sessionResult.profile,
        updatedAt: new Date().toISOString(),
      },
      savedAt: new Date().toISOString(),
    };
  }

  return { recommendation, session };
}
