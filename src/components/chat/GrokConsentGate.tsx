"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceptGrokConsentOnServer,
  fetchServerGrokConsent,
  hasGrokConsent,
  setGrokConsent,
} from "@/lib/grok/consent";
import { useAuth } from "@/components/providers/auth-provider";
import { PageLoader } from "@/components/ui/page-loader";

interface GrokConsentGateProps {
  children: React.ReactNode;
}

export function GrokConsentGate({ children }: GrokConsentGateProps) {
  const t = useTranslations("chat.consent");
  const tCommon = useTranslations("common");
  const { user, loading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    void (async () => {
      if (!user) {
        setReady(true);
        return;
      }

      const serverConsent = await fetchServerGrokConsent();
      if (serverConsent === true) {
        setGrokConsent();
        setAccepted(true);
      } else if (hasGrokConsent()) {
        const migrated = await acceptGrokConsentOnServer();
        if (migrated) {
          setAccepted(true);
        }
      }

      setReady(true);
    })();
  }, [user, authLoading]);

  if (!ready || authLoading) {
    return <PageLoader label={tCommon("loading")} />;
  }

  if (accepted) return <>{children}</>;

  return (
    <div className="relative flex h-full flex-col">
      <div className="pointer-events-none flex h-full flex-col opacity-40 blur-[1px]">
        {children}
      </div>
      <div
        className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grok-consent-title"
      >
        <Card className="max-w-lg shadow-lg">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <CardTitle id="grok-consent-title">{t("title")}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t("description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{t("details")}</p>
            <Button
              className="w-full"
              disabled={submitting}
              onClick={() => {
                void (async () => {
                  setSubmitting(true);
                  const ok = await acceptGrokConsentOnServer();
                  if (ok) {
                    setGrokConsent();
                    setAccepted(true);
                  }
                  setSubmitting(false);
                })();
              }}
            >
              {t("accept")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
