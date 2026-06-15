import type { Locale } from "@/i18n/routing";

const FILENAME_STEM: Record<Locale, string> = {
  cs: "pay-guard-doporuceni",
  ru: "pay-guard-rekomendacii",
  en: "pay-guard-recommendation",
};

/** Localized attachment name for recommendation PDF export. */
export function getRecommendationPdfFilename(
  locale: Locale,
  date = new Date().toISOString().slice(0, 10)
): string {
  return `${FILENAME_STEM[locale]}-${date}.pdf`;
}
