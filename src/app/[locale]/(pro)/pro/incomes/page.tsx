import { setRequestLocale } from "next-intl/server";
import { ProIncomesView } from "@/components/pro/incomes/pro-incomes-view";
import { routing, type Locale } from "@/i18n/routing";

export default async function ProIncomesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safe = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;
  setRequestLocale(safe);
  return <ProIncomesView />;
}
