"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LogIn, LogOut, Menu, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { InstallAppButton } from "@/components/pwa/InstallPrompt";
import { NetworkStatusBadge } from "@/components/pwa/NetworkStatusBadge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-provider";

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const links = [
    { href: `/${locale}`, label: t("nav.chat") },
    { href: `/${locale}/manual`, label: t("nav.manual") },
    { href: `/${locale}/consultations`, label: t("nav.consultations") },
    { href: `/${locale}/pricing`, label: t("nav.pricing") },
    { href: `/${locale}/settings`, label: t("nav.settings") },
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const handleSignOut = async () => {
    toast(t("toast.signedOut"), "success");
    await signOut();
  };

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
            pathname === link.href && "bg-muted font-medium",
            mobile && "block w-full"
          )}
          onClick={() => mobile && setMobileOpen(false)}
        >
          {link.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link
          href={`/${locale}`}
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <Shield className="h-6 w-6 text-primary" aria-hidden />
          <span>{t("app.name")}</span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label={t("common.mainNav")}
        >
          <NavLinks />
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <NetworkStatusBadge className="hidden sm:inline-flex" />
          <InstallAppButton variant="outline" size="sm" className="hidden sm:inline-flex" />
          <LanguageSwitcher />

          {user ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 sm:inline-flex"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {t("auth.signOut")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href={`/${locale}/login`}>
                <LogIn className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t("auth.loginLink")}
              </Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? t("common.close") : t("common.menu")}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div
          id="mobile-nav"
          ref={menuRef}
          className="border-t bg-background px-4 py-3 md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label={t("common.mainNav")}>
            <NavLinks mobile />
            <div className="mt-2 flex flex-col gap-2 border-t pt-3">
              <InstallAppButton variant="outline" size="sm" className="w-full" />
              {user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className="h-4 w-4" />
                  {t("auth.signOut")}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                  <Link href={`/${locale}/login`}>{t("auth.loginLink")}</Link>
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
