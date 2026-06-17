"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Cloud,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { PdfDownloadButton } from "@/components/pdf/pdf-download-button";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConsultationsSkeleton } from "@/components/pro/pro-skeletons";
import {
  ProEmptyState,
  ProPageHeader,
} from "@/components/pro/pro-page";
import {
  useChatHistory,
  type ConsultationSessionItem,
} from "@/hooks/use-chat-history";
import { useRecommendationPdfDownload } from "@/hooks/use-recommendation-pdf";
import { useProAccess } from "@/hooks/use-pro-access";
import { extractRecommendationFromMessages } from "@/lib/export/extractRecommendation";
import type { Locale } from "@/i18n/routing";
import { getIntlLocale } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast-provider";

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(getIntlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface SessionCardProps {
  session: ConsultationSessionItem;
  locale: Locale;
  openLabel: string;
  viewLabel: string;
  messagesLabel: string;
  hasRecommendationLabel: string;
  syncedLabel: string;
  localOnlyLabel: string;
  untitledLabel: string;
  downloadPdfLabel: string;
  generatingPdfLabel: string;
  isPro: boolean;
  isGeneratingPdf: boolean;
  onDownloadPdf: (sessionId: string) => void;
}

function SessionCard({
  session,
  locale,
  openLabel,
  viewLabel,
  messagesLabel,
  hasRecommendationLabel,
  syncedLabel,
  localOnlyLabel,
  untitledLabel,
  downloadPdfLabel,
  generatingPdfLabel,
  isPro,
  isGeneratingPdf,
  onDownloadPdf,
}: SessionCardProps) {
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all",
        "hover:border-primary/30 hover:shadow-md"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1 text-xs font-normal">
          <MessageSquare className="h-3 w-3" aria-hidden />
          {messagesLabel}
        </Badge>
        {session.hasRecommendation && (
          <Badge
            variant="outline"
            className="gap-1 border-primary/30 bg-primary/5 text-xs font-normal text-primary"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            {hasRecommendationLabel}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={cn(
            "gap-1 text-xs font-normal",
            session.isSynced
              ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300"
              : "text-muted-foreground"
          )}
        >
          {session.isSynced ? (
            <Cloud className="h-3 w-3" aria-hidden />
          ) : (
            <Smartphone className="h-3 w-3" aria-hidden />
          )}
          {session.isSynced ? syncedLabel : localOnlyLabel}
        </Badge>
      </div>

      <h2 className="mb-1 line-clamp-2 text-base font-semibold leading-snug">
        {session.preview || untitledLabel}
      </h2>
      <time
        dateTime={session.updatedAt}
        className="mb-4 text-sm text-muted-foreground"
      >
        {formatDate(session.updatedAt, locale)}
      </time>

      <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href={`/${locale}?session=${session.sessionId}`}>
            {openLabel}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
          <Link href={`/${locale}/consultations/${session.sessionId}`}>
            {viewLabel}
          </Link>
        </Button>
        {session.hasRecommendation && isPro && (
          <PdfDownloadButton
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            isGenerating={isGeneratingPdf}
            downloadLabel={downloadPdfLabel}
            generatingLabel={generatingPdfLabel}
            onClick={() => onDownloadPdf(session.sessionId)}
          />
        )}
      </div>
    </article>
  );
}

export function ConsultationsView() {
  const t = useTranslations("consultations");
  const tRec = useTranslations("recommendation");
  const tErrors = useTranslations("errors");
  const locale = useLocale() as Locale;
  const { user, loading: authLoading } = useAuth();
  const { isProEnabled: hasProCloud } = useProAccess();
  const { downloadPdf, isGeneratingForKey, isPro } = useRecommendationPdfDownload();

  const [sessions, setSessions] = useState<ConsultationSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { listSessions, restore } = useChatHistory({
    locale,
    messages: [],
    profile: { availableFunds: 0, debts: [] },
    sessionId: "",
    enabled: false,
    isAuthenticated: Boolean(user),
  });

  const loadSessions = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(false);

      try {
        setSessions(await listSessions());
      } catch {
        setError(true);
        setSessions([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [listSessions]
  );

  useEffect(() => {
    if (authLoading) return;
    void loadSessions();
  }, [authLoading, loadSessions]);

  const messagesLabel = (count: number) => t("messages", { count });

  const handleDownloadPdf = useCallback(
    (sessionId: string) =>
      downloadPdf(
        async () => {
          const saved = await restore(sessionId);
          const recommendation = saved
            ? extractRecommendationFromMessages(saved.messages)
            : null;

          if (!saved || !recommendation) {
            toast(tRec("pdfMissing"), "error");
            return null;
          }

          return {
            recommendation,
            profile: saved.profile,
            locale,
          };
        },
        { downloadKey: sessionId }
      ),
    [downloadPdf, locale, restore, tRec]
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ProPageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading || refreshing}
              onClick={() => void loadSessions(true)}
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
                aria-hidden
              />
              {t("refresh")}
            </Button>
            <Button asChild size="sm" className="gap-2">
              <Link href={`/${locale}`}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("newConsultation")}
              </Link>
            </Button>
          </div>
        }
      />

      {hasProCloud && (
        <p className="mb-6 text-sm text-muted-foreground">{t("proCloudHint")}</p>
      )}

      {loading ? (
        <ConsultationsSkeleton label={t("loading")} />
      ) : error && sessions.length === 0 ? (
        <ProEmptyState
          icon={<AlertTriangle className="h-6 w-6 text-destructive/70" />}
          title={t("loadError")}
          description={t("loadErrorHint")}
          action={
            <Button variant="secondary" onClick={() => void loadSessions()}>
              {tErrors("retry")}
            </Button>
          }
        />
      ) : sessions.length === 0 ? (
        <ProEmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <Link href={`/${locale}`}>{t("startFirst")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sessions.map((session) => (
            <li key={session.sessionId}>
              <SessionCard
                session={session}
                locale={locale}
                openLabel={t("open")}
                viewLabel={t("view")}
                messagesLabel={messagesLabel(session.messageCount)}
                hasRecommendationLabel={t("hasRecommendation")}
                syncedLabel={t("synced")}
                localOnlyLabel={t("localOnly")}
                untitledLabel={t("untitled")}
                downloadPdfLabel={tRec("downloadPdf")}
                generatingPdfLabel={tRec("generatingPdf")}
                isPro={isPro}
                isGeneratingPdf={isGeneratingForKey(session.sessionId)}
                onDownloadPdf={(sessionId) => void handleDownloadPdf(sessionId)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
