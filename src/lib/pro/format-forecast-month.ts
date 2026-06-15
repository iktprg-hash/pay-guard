import type { Locale } from "@/i18n/routing";

/** Format ISO year-month (e.g. 2026-06) for display. */
export function formatForecastMonth(yearMonth: string, locale: Locale): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
