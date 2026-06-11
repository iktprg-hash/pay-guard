"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { PageLoader } from "@/components/ui/page-loader";
import { useAuth } from "@/components/providers/auth-provider";
import { useTranslations } from "next-intl";

/** Skryje header na login/register stránkách */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();
  const t = useTranslations("common");
  const isAuthPage =
    pathname.includes("/login") ||
    pathname.includes("/register") ||
    pathname.includes("/forgot-password") ||
    pathname.includes("/reset-password");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <SkipToContent />
      <Header />
      <OfflineBanner />
      <main id="main-content" className="flex min-h-0 flex-1 flex-col">
        {loading ? <PageLoader label={t("loading")} /> : children}
      </main>
      <AppFooter />
    </>
  );
}
