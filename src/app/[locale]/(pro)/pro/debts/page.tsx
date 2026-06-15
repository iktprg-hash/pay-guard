import { setRequestLocale } from "next-intl/server";
import { ProDebtsView } from "@/components/pro/debts/pro-debts-view";
import { getProPageMetadata } from "@/lib/seo/pro-page-metadata";
import { routing, type Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return getProPageMetadata(locale, "pro.debts");
}

export default async function ProDebtsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safe = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;
  setRequestLocale(safe);
  return <ProDebtsView />;
}
