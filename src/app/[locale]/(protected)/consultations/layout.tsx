import type { ReactNode } from "react";
import { requireProPageUser } from "@/lib/auth/require-pro";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

export default async function ConsultationsLayout({
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

  await requireProPageUser(safe);
  return children;
}
