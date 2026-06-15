import { setRequestLocale } from "next-intl/server";
import { ProExpensesView } from "@/components/pro/expenses/pro-expenses-view";
import { routing, type Locale } from "@/i18n/routing";

export default async function ProExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safe = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;
  setRequestLocale(safe);
  return <ProExpensesView />;
}
