import type { Locale } from "@/i18n/routing";
import { BASE_CURRENCY } from "@/lib/financial/currency-convert";

export interface LocaleMarketConfig {
  /** Always CZK — Czech market */
  currency: typeof BASE_CURRENCY;
  /** BCP 47 for Intl (number/date formatting) */
  intlLocale: string;
  /** Market context for prompts — Czech Republic in all UI languages */
  marketName: Record<"cs" | "ru" | "en", string>;
}

export const LOCALE_MARKET: Record<Locale, LocaleMarketConfig> = {
  cs: {
    currency: BASE_CURRENCY,
    intlLocale: "cs-CZ",
    marketName: {
      cs: "Česká republika",
      ru: "Чехия",
      en: "Czech Republic",
    },
  },
  ru: {
    currency: BASE_CURRENCY,
    intlLocale: "ru-RU",
    marketName: {
      cs: "Česká republika",
      ru: "Чехия",
      en: "Czech Republic",
    },
  },
  en: {
    currency: BASE_CURRENCY,
    intlLocale: "en-CZ",
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

export function getCurrency(_locale: Locale): typeof BASE_CURRENCY {
  return BASE_CURRENCY;
}

/** Round to whole CZK */
export function roundMoney(amount: number): number {
  return Math.max(0, Math.round(amount));
}

/** Format amount in CZK — locale affects grouping/separators only */
export function formatMoney(amount: number, locale: Locale): string {
  const { intlLocale, currency } = LOCALE_MARKET[locale];
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

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
