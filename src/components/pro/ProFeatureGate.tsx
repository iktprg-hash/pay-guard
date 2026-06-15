"use client";

import { memo, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProAccess } from "@/hooks/use-pro-access";
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

interface ProLockedOverlayProps {
  className?: string;
}

/** Centered overlay for gated Pro preview content. */
function ProLockedOverlay({ className }: ProLockedOverlayProps) {
  const t = useTranslations("pro.upgrade");
  const locale = useLocale() as Locale;

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center rounded-xl",
        "bg-gradient-to-b from-background/55 via-background/72 to-background/88",
        "backdrop-blur-[3px]",
        "dark:from-background/65 dark:via-background/78 dark:to-background/92",
        className
      )}
      role="region"
      aria-label={t("overlayLabel")}
    >
      <div className="mx-auto max-w-sm px-6 py-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
          <Lock className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <p className="text-lg font-semibold tracking-tight">{t("overlayLabel")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("overlayHint")}</p>
        <Button asChild className="mt-5 gap-2 shadow-sm" size="sm">
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
 * Central Pro feature gate — full access for Pro, soft blur + overlay for Free.
 * Uses {@link useProAccess} when tier props are not provided.
 */
function ProFeatureGateInner({
  children,
  fallback,
  isProEnabled: isProOverride,
  loading: loadingOverride,
  className,
}: ProFeatureGateProps) {
  const t = useTranslations("pro.upgrade");
  const access = useProAccess();
  const isProEnabled = isProOverride ?? access.isProEnabled;
  const loading = loadingOverride ?? access.loading;

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
      className={cn("relative space-y-4", className)}
      role="region"
      aria-label={t("bannerTitle")}
      aria-describedby={fallback ? undefined : "pro-locked-hint"}
    >
      <ProUpgradeBanner />

      {fallback ?? (
        <div className="relative min-h-[12rem] overflow-hidden rounded-xl border border-border/50 shadow-sm">
          <div
            className={cn(
              "pointer-events-none select-none",
              "scale-[1.01] blur-sm brightness-[0.92] contrast-[0.95]",
              "dark:brightness-[0.88] dark:contrast-[0.9]"
            )}
            aria-hidden
            inert
          >
            {children}
          </div>
          <ProLockedOverlay />
        </div>
      )}

      {!fallback && (
        <p
          id="pro-locked-hint"
          className="text-center text-sm text-muted-foreground"
        >
          {t("lockedHint")}
        </p>
      )}
    </div>
  );
}

export const ProFeatureGate = memo(ProFeatureGateInner);
