import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";

type ProPageNamespace =
  | "pro.dashboard"
  | "pro.debts"
  | "pro.incomes"
  | "pro.expenses"
  | "pro.forecast";

function resolveLocale(locale: string): Locale {
  return routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;
}

/** Shared generateMetadata helper for Pro sub-pages. */
export async function getProPageMetadata(
  locale: string,
  namespace: ProPageNamespace
): Promise<Metadata> {
  const safe = resolveLocale(locale);
  const t = await getTranslations({ locale: safe, namespace });

  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

/** Consultations page metadata (protected route, Pro feature). */
export async function getConsultationsPageMetadata(
  locale: string
): Promise<Metadata> {
  const safe = resolveLocale(locale);
  const t = await getTranslations({ locale: safe, namespace: "consultations" });

  return {
    title: t("title"),
    description: t("subtitle"),
  };
}
