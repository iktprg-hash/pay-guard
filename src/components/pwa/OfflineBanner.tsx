"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/chat/recommendation-card";
import { useNetworkStatus } from "@/components/pwa/NetworkProvider";
import { loadOfflineBundleCacheFirst } from "@/lib/offline/cache-first";
import type {
  OfflineRecommendationSnapshot,
  OfflineSessionSnapshot,
} from "@/lib/offline/storage";
import type { Locale } from "@/i18n/routing";

/**
 * Compact offline notice — stays below header, app remains usable.
 * Expands to show cache-first recommendation + last session preview.
 */
export function OfflineBanner() {
  const t = useTranslations("pwa.offline");
  const locale = useLocale() as Locale;
  const { isOnline } = useNetworkStatus();
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<{
    recommendation: OfflineRecommendationSnapshot | null;
    session: OfflineSessionSnapshot | null;
  } | null>(null);

  const loadCached = useCallback(async () => {
    const bundle = await loadOfflineBundleCacheFirst(locale);
    setData(bundle);
    return bundle;
  }, [locale]);

  useEffect(() => {
    if (isOnline) {
      setExpanded(false);
      return;
    }
    void loadCached().then((bundle) => {
      if (bundle.recommendation) setExpanded(true);
    });
  }, [isOnline, loadCached]);

  if (isOnline) return null;

  const dateLocale =
    locale === "cs" ? "cs-CZ" : locale === "ru" ? "ru-RU" : "en-US";

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-500/30 bg-amber-500/10"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2.5">
        <div className="flex items-start gap-3">
          <WifiOff
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-50">
              {t("bannerTitle")}
            </p>
            <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
              {t("bannerSubtitle")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-1 h-3.5 w-3.5" />
                {t("hideData")}
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3.5 w-3.5" />
                {t("showData")}
              </>
            )}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-3 border-t border-amber-500/20 pt-3">
            {data?.recommendation ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("lastRecommendation")}
                </p>
                <RecommendationCard
                  result={data.recommendation.result}
                  locale={dateLocale}
                />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-amber-500/30 p-4 text-center text-sm text-muted-foreground">
                {t("noRecommendation")}
              </p>
            )}

            {data?.session && (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-background/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("lastSessionPreview")}
                </p>
                {data.session.session.messages.slice(-8).map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <span className="font-medium text-primary">
                      {msg.role === "user" ? t("you") : "Pay Guard"}:
                    </span>{" "}
                    <span className="text-muted-foreground">{msg.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
