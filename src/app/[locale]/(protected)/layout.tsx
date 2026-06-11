import type { ReactNode } from "react";
import { requirePageUser } from "@/lib/auth/server-page-guard";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

export default async function ProtectedLayout({
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

  await requirePageUser(safe);
  return children;
}
