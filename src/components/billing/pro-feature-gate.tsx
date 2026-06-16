"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Lock, Loader2, Sparkles } from "lucide-react";
import { useProAccess } from "@/hooks/use-pro-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export interface ProFeatureGateProps {
  children: React.ReactNode;
  /** Optional — overrides locale from useLocale() */
  locale?: Locale;
  /** @deprecated Pass-through for ProShell — prefer hook defaults */
  isProEnabled?: boolean;
  /** @deprecated Pass-through for ProShell — prefer hook defaults */
  loading?: boolean;
  className?: string;
  fallback?: React.ReactNode;
}

export function ProFeatureGate({
  children,
  locale: localeProp,
  isProEnabled: isProOverride,
  loading: loadingOverride,
  className,
  fallback,
}: ProFeatureGateProps) {
  const t = useTranslations("gate");
  const hookLocale = useLocale() as Locale;
  const locale = localeProp ?? hookLocale;
  const access = useProAccess();
  const pro = isProOverride ?? access.isProEnabled;
  const loading = loadingOverride ?? access.loading;

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        className={cn("flex items-center gap-2 py-8 text-muted-foreground", className)}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t("loadingPro")}</span>
      </div>
    );
  }

  if (pro) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const upgradeBannerLabel = t("upgradeBanner");
  const pricingHref = `/${locale}/pricing`;

  return (
    <section
      role="region"
      aria-label={upgradeBannerLabel}
      className={cn("relative space-y-4", className)}
    >
      <Card
        role="region"
        aria-label={upgradeBannerLabel}
        className="border-primary/40 bg-primary/5"
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {upgradeBannerLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href={pricingHref}>{t("upgradeCta")}</Link>
          </Button>
        </CardContent>
      </Card>

      <section
        role="region"
        aria-label={t("proOverlay")}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/80 backdrop-blur-sm"
      >
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">{t("lockedHint")}</p>
        <Button asChild size="sm" variant="default">
          <Link href={pricingHref}>{t("upgradeCta")}</Link>
        </Button>
      </section>

      <div aria-hidden="true" className="blur-sm pointer-events-none select-none">
        {children}
      </div>
    </section>
  );
}

/** @deprecated Use ProFeatureGate — kept for legacy imports */
export function ProUpgradeBanner() {
  return null;
}
