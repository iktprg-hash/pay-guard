"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { WifiOff, RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/chat/recommendation-card";
import { useNetworkStatus } from "@/components/pwa/NetworkProvider";
import {
  loadOfflineBundle,
  type OfflineRecommendationSnapshot,
  type OfflineSessionSnapshot,
} from "@/lib/offline/storage";
import type { Locale } from "@/i18n/routing";

/**
 * Fullscreen offline panel — zobrazí se při ztrátě připojení.
 * Uživatel vidí poslední doporučení a může prohlédnout poslední relaci.
 */
export function OfflineShell() {
  const t = useTranslations("pwa.offline");
  const locale = useLocale() as Locale;
  const { isOnline } = useNetworkStatus();
  const [data, setData] = useState<{
    recommendation: OfflineRecommendationSnapshot | null;
    session: OfflineSessionSnapshot | null;
  } | null>(null);
  const [showSession, setShowSession] = useState(false);

  useEffect(() => {
    if (isOnline) return;
    loadOfflineBundle(locale).then(setData);
  }, [isOnline, locale]);

  if (isOnline) return null;

  const dateLocale =
    locale === "cs" ? "cs-CZ" : locale === "ru" ? "ru-RU" : "en-US";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      className="fixed inset-0 z-[100] flex flex-col bg-background/98 backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15">
            <WifiOff className="h-7 w-7 text-amber-500" aria-hidden />
          </div>
          <h2 id="offline-title" className="text-xl font-semibold">
            {t("title")}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {data?.recommendation ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("lastRecommendation")}
            </p>
            <RecommendationCard
              result={data.recommendation.result}
              locale={dateLocale}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("noRecommendation")}
          </p>
        )}

        {data?.session && (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowSession((v) => !v)}
            >
              <MessageSquare className="h-4 w-4" />
              {showSession ? t("hideSession") : t("viewSession")}
            </Button>
            {showSession && (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border bg-muted/30 p-4">
                {data.session.session.messages.slice(-20).map((msg) => (
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

        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4" />
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
