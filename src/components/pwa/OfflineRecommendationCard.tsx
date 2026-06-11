"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { RecommendationCard } from "@/components/chat/recommendation-card";
import { useOfflineRecommendation } from "@/hooks/use-offline-recommendation";
import type { Locale } from "@/i18n/routing";

/** Inline card — last recommendation when offline (chat / manual pages) */
export function OfflineRecommendationCard({ locale }: { locale: Locale }) {
  const t = useTranslations("pwa.offline");
  const { snapshot, showOfflineHint, loading } = useOfflineRecommendation();

  if (loading || !showOfflineHint || !snapshot) return null;

  return (
    <div className="mx-auto mb-6 max-w-3xl animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-transparent p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          {t("cachedRecommendationTitle")}
        </div>
        <RecommendationCard result={snapshot.result} />
      </div>
    </div>
  );
}
