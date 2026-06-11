"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LogOut, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const links = [
    { href: `/${locale}`, label: t("nav.chat") },
    { href: `/${locale}/consultations`, label: t("nav.consultations") },
    { href: `/${locale}/manual`, label: t("nav.manual") },
    { href: `/${locale}/pricing`, label: t("nav.pricing") },
    { href: `/${locale}/settings`, label: t("nav.settings") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href={`/${locale}`} className="flex shrink-0 items-center gap-2 font-semibold">
          <Shield className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline">{t("app.name")}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
                pathname === link.href && "bg-muted font-medium"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!loading && user && (
            <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground lg:inline">
              {user.email}
            </span>
          )}
          {!loading && user ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => signOut()}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("auth.signOut")}</span>
            </Button>
          ) : !loading ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${locale}/login`}>{t("auth.signIn")}</Link>
            </Button>
          ) : null}
          <Link
            href={`/${locale}/settings`}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
            aria-label={t("nav.settings")}
          >
            <Settings className="h-5 w-5" />
          </Link>
          <Badge variant="outline" className="hidden lg:inline-flex">
            {t("nav.pro")}
          </Badge>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
