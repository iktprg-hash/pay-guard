"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { PdfDownloadButton } from "@/components/pdf/pdf-download-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRecommendationPdfDownload } from "@/hooks/use-recommendation-pdf";
import {
  importServerSession,
  loadStoredSession,
  type StoredMessage,
} from "@/lib/chat/storage";
import { generateSessionToken } from "@/lib/security/token";
import type { UserSessionBundle } from "@/lib/chat/persistence";
import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

export interface ConsultationDetailProps {
  sessionId: string;
  locale: Locale;
  isPro: boolean;
}

interface PdfExportButtonProps {
  recommendation: PrioritizationResult;
  profile: FinancialProfile;
  locale: Locale;
  sessionId: string;
}

function PdfExportButton({
  recommendation,
  profile,
  locale,
  sessionId,
}: PdfExportButtonProps) {
  const t = useTranslations("recommendation");
  const { downloadPdf, isGeneratingForKey } = useRecommendationPdfDownload();

  return (
    <PdfDownloadButton
      variant="outline"
      size="sm"
      className="mt-2"
      isGenerating={isGeneratingForKey(sessionId)}
      downloadLabel={t("downloadPdf")}
      generatingLabel={t("generatingPdf")}
      onClick={() =>
        void downloadPdf(
          { recommendation, profile, locale },
          { downloadKey: sessionId }
        )
      }
    />
  );
}

export function ConsultationDetail({
  sessionId,
  locale,
  isPro,
}: ConsultationDetailProps) {
  const t = useTranslations("consultations");
  const tRec = useTranslations("recommendation");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [profile, setProfile] = useState<FinancialProfile>({
    availableFunds: 0,
    debts: [],
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setNotFound(false);

      try {
        const local = await loadStoredSession(sessionId);
        if (local) {
          setMessages(local.messages);
          setProfile(local.profile);
          return;
        }

        if (!isPro) {
          setNotFound(true);
          return;
        }

        const res = await fetch(`/api/sessions/${sessionId}`, {
          credentials: "include",
        });

        if (!res.ok) {
          setNotFound(true);
          return;
        }

        const data = (await res.json()) as {
          session?: UserSessionBundle;
        } & Partial<UserSessionBundle>;

        const session = data.session ?? (data as UserSessionBundle);
        if (!session.sessionId) {
          setNotFound(true);
          return;
        }

        await importServerSession({
          sessionId: session.sessionId,
          sessionToken: generateSessionToken(),
          locale: session.locale,
          messages: session.messages,
          profile: session.profile,
          updatedAt: session.updatedAt,
          preview: session.preview,
        });

        setMessages(session.messages);
        setProfile(session.profile);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [isPro, sessionId]);

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex min-h-[40vh] items-center justify-center"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (notFound) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("notFound")}</CardTitle>
          <CardDescription>{t("notFoundHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/${locale}/consultations`}
            className="text-sm text-primary hover:underline"
          >
            {t("back")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href={`/${locale}/consultations`}
          aria-label={t("backLabel")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("back")}
        </Link>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${locale}?session=${sessionId}`}>
            {t("openInChat")}
          </Link>
        </Button>
      </div>

      <section
        aria-label={t("transcriptLabel")}
        className="space-y-4"
      >
        {messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((msg) => (
            <div
              key={msg.id}
              className={msg.role === "user" ? "text-right" : "text-left"}
            >
              <p className="mb-1 text-xs text-muted-foreground">
                {msg.role === "user" ? t("you") : t("assistant")}
              </p>
              <div
                className={cn(
                  "inline-block max-w-[85%] rounded-lg px-4 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.content}
              </div>
              {msg.recommendation && isPro ? (
                <PdfExportButton
                  recommendation={msg.recommendation}
                  profile={profile}
                  locale={locale}
                  sessionId={sessionId}
                />
              ) : null}
              {msg.recommendation && !isPro ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {tRec("pdfProOnly")}{" "}
                  <Link
                    href={`/${locale}/pricing`}
                    className="font-medium text-primary hover:underline"
                  >
                    {tRec("pdfGoPro")}
                  </Link>
                </p>
              ) : null}
            </div>
          ))}
      </section>
    </div>
  );
}
