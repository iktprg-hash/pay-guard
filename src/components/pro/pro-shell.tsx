"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  LogOut,
  Shield,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ProTierBadge } from "@/components/pro/pro-tier-badge";
import { PRO_NAV_ITEMS, isProNavActive } from "@/components/pro/pro-nav";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast-provider";
import { useProAccess } from "@/hooks/use-pro-access";
import { ProCriticalAlert } from "@/components/pro/pro-critical-alert";
import {
  ProFeatureGate,
} from "@/components/pro/ProFeatureGate";
import { ProErrorBoundary } from "@/components/pro/ProErrorBoundary";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

// ---------------------------------------------------------------------------
// Desktop sidebar
// ---------------------------------------------------------------------------

interface ProShellSidebarProps {
  tier: SubscriptionTier;
  tierLoading?: boolean;
  onSignOut: () => void;
  signingOut?: boolean;
}

function ProShellSidebar({
  tier,
  tierLoading,
  onSignOut,
  signingOut,
}: ProShellSidebarProps) {
  const t = useTranslations("pro");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const pathname = usePathname();

  return (
    <aside className="hidden w-[17.5rem] shrink-0 flex-col border-r border-border/60 bg-card md:flex">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">
            {t("brand")}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3" aria-label={t("navLabel")}>
        {PRO_NAV_ITEMS.map((item) => {
          const href = item.href(locale);
          const active = isProNavActive(pathname, href);
          const Icon = item.icon;

          return (
            <Link
              key={item.labelKey}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                "hover:bg-muted/80",
                active &&
                  "bg-primary/10 font-medium text-primary shadow-sm ring-1 ring-primary/15"
              )}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted",
                  active && "bg-primary/15"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
              </span>
              {t(`nav.${item.labelKey}`)}
            </Link>
          );
        })}
      </nav>

      {/* Footer: tier, locale, actions */}
      <div className="space-y-3 border-t p-4">
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("currentPlan")}
            </span>
            <ProTierBadge tier={tier} loading={tierLoading} />
          </div>
          <LanguageSwitcher />
        </div>

        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {t("backToApp")}
        </Link>

        <Separator />

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          onClick={onSignOut}
          disabled={signingOut}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {tAuth("signOut")}
        </Button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile bottom navigation
// ---------------------------------------------------------------------------

function ProShellBottomNav() {
  const t = useTranslations("pro");
  const locale = useLocale() as Locale;
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/85 md:hidden"
      aria-label={t("navLabel")}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {PRO_NAV_ITEMS.map((item) => {
          const href = item.href(locale);
          const active = isProNavActive(pathname, href);
          const Icon = item.icon;

          return (
            <Link
              key={item.labelKey}
              href={href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                  aria-hidden
                />
              )}
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">{t(`nav.${item.labelKey}`)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Main shell
// ---------------------------------------------------------------------------

/** Pro layout shell — sidebar (desktop), bottom nav (mobile), tier & logout. */
export function ProShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("pro");
  const tAuth = useTranslations("auth");
  const tToast = useTranslations("toast");
  const locale = useLocale() as Locale;
  const { signOut } = useAuth();
  const {
    isProEnabled,
    loading: accessLoading,
    subscriptionTier,
  } = useProAccess();

  const handleSignOut = () => {
    toast(tToast("signedOut"), "success");
    void signOut();
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-background via-background to-muted/20 md:flex-row">
      <ProShellSidebar
        tier={subscriptionTier}
        tierLoading={accessLoading}
        onSignOut={handleSignOut}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/90 px-4 backdrop-blur-md md:hidden">
          <Link
            href={`/${locale}/pro/dashboard`}
            className="flex min-w-0 items-center gap-2.5 font-semibold"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <span className="truncate">{t("brand")}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <ProTierBadge
              tier={subscriptionTier}
              loading={accessLoading}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={handleSignOut}
              aria-label={tAuth("signOut")}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <OfflineBanner />

        <main
          className="flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8"
          aria-busy={accessLoading || undefined}
        >
          <ProCriticalAlert />
          <ProErrorBoundary>
            <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
              <ProFeatureGate
                isProEnabled={isProEnabled}
                loading={accessLoading}
              >
                {children}
              </ProFeatureGate>
            </div>
          </ProErrorBoundary>
        </main>
      </div>

      <ProShellBottomNav />
    </div>
  );
}

/** Mobile bottom nav — exported for reuse. */
export function ProMobileNav() {
  return <ProShellBottomNav />;
}

/** Desktop sidebar with built-in sign-out — exported for reuse. */
export function ProSidebar({
  tier,
  tierLoading,
}: {
  tier: SubscriptionTier;
  tierLoading?: boolean;
}) {
  const tToast = useTranslations("toast");
  const { signOut } = useAuth();

  const handleSignOut = () => {
    toast(tToast("signedOut"), "success");
    void signOut();
  };

  return (
    <ProShellSidebar
      tier={tier}
      tierLoading={tierLoading}
      onSignOut={handleSignOut}
    />
  );
}
