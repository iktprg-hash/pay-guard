"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { ConsultationCard } from "@/components/consultations/consultation-card";
import { Button } from "@/components/ui/button";
import { listLocalSessions } from "@/lib/chat/storage";
import type { SessionSummary } from "@/lib/chat/persistence";
import type { Locale } from "@/i18n/routing";

export interface ConsultationListProps {
  locale: Locale;
  isPro: boolean;
}

interface ConsultationItem {
  id: string;
  preview: string;
  messageCount: number;
  hasRecommendation: boolean;
  updatedAt: string;
  synced: boolean;
  locale: string;
}

function mergeSessions(
  local: Awaited<ReturnType<typeof listLocalSessions>>,
  cloud: SessionSummary[]
): ConsultationItem[] {
  const map = new Map<string, ConsultationItem>();

  for (const meta of local) {
    map.set(meta.sessionId, {
      id: meta.sessionId,
      preview: meta.preview,
      messageCount: meta.messageCount,
      hasRecommendation: Boolean(meta.hasRecommendation),
      updatedAt: meta.updatedAt,
      synced: false,
      locale: meta.locale,
    });
  }

  for (const session of cloud) {
    const existing = map.get(session.id);
    if (existing) {
      map.set(session.id, {
        ...existing,
        preview: session.preview || existing.preview,
        messageCount: session.messageCount,
        hasRecommendation: session.hasRecommendation,
        updatedAt: session.updatedAt,
        synced: true,
        locale: session.locale,
      });
    } else {
      map.set(session.id, {
        id: session.id,
        preview: session.preview,
        messageCount: session.messageCount,
        hasRecommendation: session.hasRecommendation,
        updatedAt: session.updatedAt,
        synced: true,
        locale: session.locale,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function ConsultationList({ locale, isPro }: ConsultationListProps) {
  const t = useTranslations("consultations");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ConsultationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const local = await listLocalSessions();
      let cloud: SessionSummary[] = [];

      if (isPro) {
        try {
          const res = await fetch("/api/sessions", { credentials: "include" });
          if (!res.ok) {
            setError(t("loadError"));
          } else {
            const data = (await res.json()) as { sessions?: SessionSummary[] };
            cloud = data.sessions ?? [];
          }
        } catch {
          setError(t("loadError"));
        }
      }

      setItems(mergeSessions(local, cloud));
    } finally {
      setLoading(false);
    }
  }, [isPro, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <p>{t("loading")}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p>{t("empty")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        <Button asChild>
          <Link href={`/${locale}`}>{t("startFirst")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          {t("refresh")}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-muted-foreground">{t("loadErrorHint")}</p>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <ConsultationCard
              id={item.id}
              preview={item.preview}
              messageCount={item.messageCount}
              hasRecommendation={item.hasRecommendation}
              updatedAt={item.updatedAt}
              synced={item.synced}
              locale={locale}
            />
          </li>
        ))}
      </ul>

      {isPro ? (
        <p className="text-xs text-muted-foreground">{t("proCloudHint")}</p>
      ) : null}
    </div>
  );
}
