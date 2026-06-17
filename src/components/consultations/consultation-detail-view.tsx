"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";
import { RecommendationCard } from "@/components/chat/recommendation-card";
import { PdfDownloadButton } from "@/components/pdf/pdf-download-button";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ConsultationsSkeleton } from "@/components/pro/pro-skeletons";
import { ProEmptyState, ProPageHeader } from "@/components/pro/pro-page";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useRecommendationPdfDownload } from "@/hooks/use-recommendation-pdf";
import { useProAccess } from "@/hooks/use-pro-access";
import { extractRecommendationFromMessages } from "@/lib/export/extractRecommendation";
import type { ChatMessage, FinancialProfile } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";
import { getIntlLocale } from "@/lib/utils";

interface ConsultationDetailViewProps {
  sessionId: string;
}

export function ConsultationDetailView({ sessionId }: ConsultationDetailViewProps) {
  const t = useTranslations("consultations");
  const tRec = useTranslations("recommendation");
  const locale = useLocale() as Locale;
  const { user, loading: authLoading } = useAuth();
  const { isProEnabled: isPro } = useProAccess();
  const { downloadPdf, isGeneratingForKey } = useRecommendationPdfDownload();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<FinancialProfile>({
    availableFunds: 0,
    debts: [],
  });
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { restore, listSessions } = useChatHistory({
    locale,
    messages: [],
    profile: { availableFunds: 0, debts: [] },
    sessionId,
    enabled: false,
    isAuthenticated: Boolean(user),
  });

  useEffect(() => {
    if (authLoading) return;

    void (async () => {
      setLoading(true);
      setNotFound(false);

      try {
        const [saved, sessions] = await Promise.all([
          restore(sessionId),
          listSessions(),
        ]);

        if (!saved) {
          setNotFound(true);
          setMessages([]);
          return;
        }

        setMessages(saved.messages);
        setProfile(saved.profile);

        const meta = sessions.find((s) => s.sessionId === sessionId);
        const firstUser = saved.messages.find((m) => m.role === "user")?.content;
        setPreview(
          meta?.preview ??
            (firstUser ? firstUser.slice(0, 120) : "") ??
            ""
        );
      } catch {
        setNotFound(true);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, listSessions, restore, sessionId]);

  const recommendation = useMemo(
    () => extractRecommendationFromMessages(messages),
    [messages]
  );

  const transcriptMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || m.role === "assistant"),
    [messages]
  );

  const handleDownloadPdf = useCallback(() => {
    if (!recommendation) return;
    void downloadPdf(
      {
        recommendation,
        profile,
        locale,
      },
      { downloadKey: sessionId }
    );
  }, [downloadPdf, locale, profile, recommendation, sessionId]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ConsultationsSkeleton label={t("loading")} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <nav aria-label={t("backLabel")} className="mb-6">
          <Link
            href={`/${locale}/consultations`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("back")}
          </Link>
        </nav>
        <ProEmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title={t("notFound")}
          description={t("notFoundHint")}
          action={
            <Button asChild variant="secondary">
              <Link href={`/${locale}/consultations`}>{t("back")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <nav aria-label={t("backLabel")}>
        <Link
          href={`/${locale}/consultations`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("back")}
        </Link>
      </nav>

      <ProPageHeader title={preview || t("untitled")} />

      <ol aria-label={t("transcriptLabel")} className="space-y-4">
        {transcriptMessages.map((msg) => (
          <li
            key={msg.id}
            data-role={msg.role}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {msg.role === "user" ? t("you") : t("assistant")}
            </span>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {msg.content}
            </p>
            <time
              dateTime={new Date(msg.timestamp).toISOString()}
              className="mt-2 block text-xs text-muted-foreground"
            >
              {new Date(msg.timestamp).toLocaleString(getIntlLocale(locale), {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        ))}
      </ol>

      {recommendation && (
        <RecommendationCard
          result={recommendation}
          profile={profile}
          downloadKey={sessionId}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {recommendation && isPro && (
          <PdfDownloadButton
            variant="outline"
            size="sm"
            isGenerating={isGeneratingForKey(sessionId)}
            downloadLabel={tRec("downloadPdf")}
            generatingLabel={tRec("generatingPdf")}
            onClick={handleDownloadPdf}
          />
        )}
        <Button asChild size="sm">
          <Link href={`/${locale}?session=${sessionId}`}>{t("openInChat")}</Link>
        </Button>
      </div>
    </div>
  );
}
