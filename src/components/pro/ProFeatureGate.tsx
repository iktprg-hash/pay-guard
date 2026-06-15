"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import type { Locale } from "@/i18n/routing";
import { ProGateSkeleton } from "@/components/pro/pro-skeletons";
import { cn } from "@/lib/utils";

interface ProUpgradeBannerProps {
  className?: string;
}

/** Upgrade CTA for Free users near gated Pro features. */
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
        <Button asChild className="shrink-0 gap-2 focus-visible:ring-2 focus-visible:ring-primary">
          <Link href={`/${locale}/pricing`} aria-label={t("cta")}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {t("cta")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export interface ProFeatureGateProps {
  children: ReactNode;
  /** Custom locked-state content instead of blurred children preview. */
  fallback?: ReactNode;
  /** Override subscription tier (e.g. when parent already loaded tier). */
  isProEnabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * Central Pro feature gate — full access for Pro, upgrade banner + preview for Free.
 * Uses {@link useSubscriptionTier} when tier props are not provided.
 */
export function ProFeatureGate({
  children,
  fallback,
  isProEnabled: isProOverride,
  loading: loadingOverride,
  className,
}: ProFeatureGateProps) {
  const t = useTranslations("pro.upgrade");
  const tier = useSubscriptionTier();
  const isProEnabled = isProOverride ?? tier.isProEnabled;
  const loading = loadingOverride ?? tier.loading;

  if (loading) {
    return (
      <ProGateSkeleton label={t("loadingGate")} className={className} />
    );
  }

  if (isProEnabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn("relative", className)}
      role="region"
      aria-label={t("bannerTitle")}
    >
      <ProUpgradeBanner className="mb-6" />
      {fallback ?? (
        <div
          className="pointer-events-none select-none opacity-40 blur-[1px]"
          aria-hidden
        >
          {children}
        </div>
      )}
      {!fallback && (
        <p
          id="pro-locked-hint"
          className="mt-4 text-center text-sm text-muted-foreground"
        >
          {t("lockedHint")}
        </p>
      )}
    </div>
  );
}
