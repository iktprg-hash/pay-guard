"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertOctagon, X } from "lucide-react";
import { useCashFlowForecast } from "@/hooks/useCashFlowForecast";
import { isPaidTier } from "@/lib/types/financial";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";

const DISMISSED_KEY = "pro_critical_alert_dismissed";

export function ProCriticalAlert() {
  const t = useTranslations("pro.criticalAlert");
  const locale = useLocale() as Locale;
  const { summary, isLoading } = useCashFlowForecast();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  if (
    isLoading ||
    dismissed ||
    !isPaidTier(summary.subscriptionTier) ||
    summary.criticalDebts.length === 0
  ) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive dark:text-red-300"
    >
      <AlertOctagon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">
        {t("message", { count: summary.criticalDebts.length })}{" "}
        <Link
          href={`/${locale}/pro/dashboard`}
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          {t("viewDashboard")}
        </Link>
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
        onClick={handleDismiss}
        aria-label={t("dismiss")}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
