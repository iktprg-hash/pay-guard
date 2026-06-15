"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

interface ProUpgradeBannerProps {
  className?: string;
}

/** Shown to Free users inside Pro shell — prompts upgrade. */
export function ProUpgradeBanner({ className }: ProUpgradeBannerProps) {
  const t = useTranslations("pro.upgrade");
  const locale = useLocale() as Locale;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-6 shadow-sm",
        className
      )}
      role="region"
      aria-label={t("bannerTitle")}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {t("bannerTitle")}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {t("bannerDescription")}
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0 gap-2">
          <Link href={`/${locale}/pricing`}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {t("cta")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface ProFeatureGateProps {
  isProEnabled: boolean;
  loading?: boolean;
  children: ReactNode;
}

/** Blurs Pro content and shows upgrade banner for Free tier. */
export function ProFeatureGate({
  isProEnabled,
  loading,
  children,
}: ProFeatureGateProps) {
  const t = useTranslations("pro.upgrade");

  if (loading) {
    return <div className="animate-pulse rounded-xl bg-muted/40 p-8" />;
  }

  if (isProEnabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <ProUpgradeBanner className="mb-6" />
      <div
        className="pointer-events-none select-none opacity-40 blur-[1px]"
        aria-hidden
      >
        {children}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("lockedHint")}
      </p>
    </div>
  );
}
