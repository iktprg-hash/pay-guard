"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, MessageSquare, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "@/components/ui/toast-provider";
import {
  listLocalSessions,
  type LocalSessionMeta,
} from "@/lib/chat/storage";
import {
  fetchServerSessions,
  syncUserSessionsOnLogin,
} from "@/lib/chat/client-sync";
import { mergeSessionLists } from "@/lib/chat/sync";
import type { Locale } from "@/i18n/routing";

function formatDate(iso: string, locale: Locale): string {
  const tag =
    locale === "cs" ? "cs-CZ" : locale === "ru" ? "ru-RU" : "en-US";
  return new Date(iso).toLocaleString(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionList() {
  const t = useTranslations("consultations");
  const tToast = useTranslations("toast");
  const tErrors = useTranslations("errors");
  const locale = useLocale() as Locale;
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<LocalSessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (user && navigator.onLine) {
        try {
          await syncUserSessionsOnLogin(locale);
        } catch {
          toast(tToast("syncFailed"), "error");
        }
        const server = await fetchServerSessions();
        const local = await listLocalSessions(locale);
        setSessions(mergeSessionLists(server, local));
      } else {
        setSessions(await listLocalSessions(locale));
      }
    } catch {
      setError(true);
      try {
        setSessions(await listLocalSessions(locale));
      } catch {
        setSessions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, locale, tToast]);

  useEffect(() => {
    if (authLoading) return;
    void loadSessions();
  }, [authLoading, loadSessions]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link href={`/${locale}`}>
            <Plus className="h-4 w-4" />
            {t("newConsultation")}
          </Link>
        </Button>
      </div>

      {!user && (
        <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          {t("anonymousHint")}
        </p>
      )}

      {loading ? (
        <PageLoader label={t("loading")} />
      ) : error && sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive/70" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("loadError")}</p>
            <Button variant="secondary" onClick={() => void loadSessions()}>
              {tErrors("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t("empty")}</p>
            <Button asChild variant="secondary">
              <Link href={`/${locale}`}>{t("startFirst")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.sessionId}>
              <Link href={`/${locale}?session=${s.sessionId}`}>
                <Card className="transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="line-clamp-2 text-base font-medium">
                        {s.preview || t("untitled")}
                      </CardTitle>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {t("messages", { count: s.messageCount })}
                      </Badge>
                    </div>
                    <CardDescription>
                      {formatDate(s.updatedAt, locale)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="inline-flex items-center gap-1 text-sm text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t("continue")}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
