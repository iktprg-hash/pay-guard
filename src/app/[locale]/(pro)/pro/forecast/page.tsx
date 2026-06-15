import { setRequestLocale } from "next-intl/server";
import { ProForecastView } from "@/components/pro/forecast/pro-forecast-view";
import { getProPageMetadata } from "@/lib/seo/pro-page-metadata";
import { routing, type Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return getProPageMetadata(locale, "pro.forecast");
}

export default async function ProForecastPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safe = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;
  setRequestLocale(safe);
  return <ProForecastView />;
}
