"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { loadRecommendationCacheFirst } from "@/lib/offline/cache-first";
import type { OfflineRecommendationSnapshot } from "@/lib/offline/storage";
import type { Locale } from "@/i18n/routing";
import { onRecommendationSaved } from "@/lib/pwa/events";
import { useNetworkStatus } from "@/components/pwa/NetworkProvider";

/** Cache-first hook for the last saved recommendation (offline PWA UX) */
export function useOfflineRecommendation() {
  const locale = useLocale() as Locale;
  const { isOnline } = useNetworkStatus();
  const [snapshot, setSnapshot] =
    useState<OfflineRecommendationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await loadRecommendationCacheFirst(locale));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void refresh();
    return onRecommendationSaved(() => {
      void refresh();
    });
  }, [refresh]);

  return {
    snapshot,
    loading,
    refresh,
    /** True when user is offline and we have a cached recommendation */
    showOfflineHint: !isOnline && Boolean(snapshot),
  };
}
