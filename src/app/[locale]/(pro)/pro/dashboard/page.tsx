import { setRequestLocale } from "next-intl/server";
import { ProDashboardView } from "@/components/pro/dashboard/pro-dashboard-view";
import { routing, type Locale } from "@/i18n/routing";

export default async function ProDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safe = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  setRequestLocale(safe);

  return <ProDashboardView />;
}
