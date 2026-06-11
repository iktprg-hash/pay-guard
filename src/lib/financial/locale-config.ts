import type { Locale } from "@/i18n/routing";

export interface LocaleMarketConfig {
  /** ISO 4217 */
  currency: "CZK" | "RUB";
  /** BCP 47 for Intl */
  intlLocale: string;
  /** Human-readable market name (for prompts) */
  marketName: Record<"cs" | "ru" | "en", string>;
}

export const LOCALE_MARKET: Record<Locale, LocaleMarketConfig> = {
  cs: {
    currency: "CZK",
    intlLocale: "cs-CZ",
    marketName: {
      cs: "Česká republika",
      ru: "Чехия",
      en: "Czech Republic",
    },
  },
  ru: {
    currency: "RUB",
    intlLocale: "ru-RU",
    marketName: {
      cs: "Rusko",
      ru: "Россия",
      en: "Russia",
    },
  },
  en: {
    currency: "CZK",
    intlLocale: "en-US",
    marketName: {
      cs: "Česká republika",
      ru: "Чехия",
      en: "Czech Republic",
    },
  },
};

export function getIntlLocale(locale: Locale): string {
  return LOCALE_MARKET[locale].intlLocale;
}

export function getCurrency(locale: Locale): "CZK" | "RUB" {
  return LOCALE_MARKET[locale].currency;
}

/** Zaokrouhlí na celé jednotky měny */
export function roundMoney(amount: number): number {
  return Math.max(0, Math.round(amount));
}

/** Formátuje částku podle locale aplikace (Kč / ₽) */
export function formatMoney(amount: number, locale: Locale): string {
  const { intlLocale, currency } = LOCALE_MARKET[locale];
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formátuje datum podle locale aplikace */
export function formatLocaleDate(
  date: string | Date,
  locale: Locale
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(d);
}
