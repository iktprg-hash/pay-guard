import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/server-page-guard";
import { routing, type Locale } from "@/i18n/routing";
import { ProShell } from "@/components/pro/pro-shell";

export default async function ProLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safe = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  setRequestLocale(safe);
  await requirePageUser(safe);

  return <ProShell>{children}</ProShell>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pro" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}
