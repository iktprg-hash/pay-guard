"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";

interface CheckoutStatusHandlerProps {
  checkout: "success" | "cancelled" | null;
  sessionId: string | null;
  locale: Locale;
}

type SuccessPhase = "confirming" | "done";

export function CheckoutStatusHandler({
  checkout,
  sessionId,
  locale,
}: CheckoutStatusHandlerProps) {
  const t = useTranslations("pricing");
  const [successPhase, setSuccessPhase] = useState<SuccessPhase>(
    sessionId ? "confirming" : "done"
  );
  const confirmStarted = useRef(false);

  useEffect(() => {
    if (checkout !== "success" || !sessionId || confirmStarted.current) {
      return;
    }
    confirmStarted.current = true;

    void (async () => {
      try {
        await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        // Webhook may have already activated Pro — still show success.
      } finally {
        setSuccessPhase("done");
      }
    })();
  }, [checkout, sessionId]);

  if (checkout === null) {
    return null;
  }

  if (checkout === "cancelled") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-12"
      >
        <Card className="w-full text-center">
          <CardHeader className="items-center space-y-4">
            <XCircle
              className="h-14 w-14 text-muted-foreground"
              aria-hidden
            />
            <CardTitle>{t("cancelledTitle")}</CardTitle>
            <CardDescription>{t("cancelledDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href={`/${locale}/pricing`}>{t("tryAgain")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (successPhase === "confirming") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-muted-foreground">{t("confirmingPayment")}</p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-12"
    >
      <Card className="w-full text-center">
        <CardHeader className="items-center space-y-4">
          <CheckCircle className="h-14 w-14 text-green-600" aria-hidden />
          <CardTitle>{t("successTitle")}</CardTitle>
          <CardDescription>{t("successDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/${locale}/settings`}>{t("goToSettings")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
