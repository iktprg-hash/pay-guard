"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { reportClientError } from "@/lib/errors/report-client-error";

/** Route-level error UI for Pro pages (Next.js error boundary). */
export default function ProRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("pro.errorBoundary");
  const locale = useLocale() as Locale;

  useEffect(() => {
    reportClientError(error, {
      boundary: "ProRouteError",
      digest: error.digest,
    });
  }, [error]);

  return (
    <div
      className="flex min-h-[50vh] flex-1 items-center justify-center p-6"
      role="alert"
      aria-live="assertive"
    >
      <Card className="w-full max-w-lg border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="default" className="flex-1">
            <Link href={`/${locale}`}>{t("backToChat")}</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => reset()}
          >
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
