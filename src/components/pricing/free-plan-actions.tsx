"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { useProAccess } from "@/hooks/use-pro-access";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";

export function FreePlanActions() {
  const t = useTranslations("pricing");
  const locale = useLocale() as Locale;
  const { user, loading: authLoading } = useAuth();
  const { isProEnabled: pro, loading: tierLoading } = useProAccess();

  const loading = authLoading || tierLoading;

  if (loading) {
    return (
      <Button className="mt-6 w-full" disabled aria-busy="true">
        {t("free.cta")}
      </Button>
    );
  }

  if (pro) return null;

  if (!user) {
    return (
      <Button className="mt-6 w-full" asChild>
        <Link href={`/${locale}/register`}>{t("free.ctaGuest")}</Link>
      </Button>
    );
  }

  return (
    <Button className="mt-6 w-full" disabled aria-disabled="true">
      {t("free.cta")}
    </Button>
  );
}
