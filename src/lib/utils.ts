import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatMoney as formatMoneyForLocale,
  formatLocaleDate as formatDateForLocale,
  getIntlLocale,
} from "@/lib/financial/locale-config";
import type { Locale } from "@/i18n/routing";

/** Sloučí Tailwind třídy bez konfliktů */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formátuje částku podle locale aplikace (cs/en → Kč, ru → ₽) */
export function formatMoney(amount: number, locale: Locale = "cs"): string {
  return formatMoneyForLocale(amount, locale);
}

/** Formátuje datum podle locale */
export function formatDate(date: string | Date, localeOrIntl: Locale | string = "cs"): string {
  const locale: Locale =
    localeOrIntl === "cs" || localeOrIntl === "ru" || localeOrIntl === "en"
      ? localeOrIntl
      : localeOrIntl.startsWith("ru")
        ? "ru"
        : localeOrIntl.startsWith("en")
          ? "en"
          : "cs";
  return formatDateForLocale(date, locale);
}

export { getIntlLocale };
