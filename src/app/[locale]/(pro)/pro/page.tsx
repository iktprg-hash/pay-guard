import { redirect } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";

/** Redirect /pro → /pro/dashboard */
export default async function ProIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safe = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  redirect(`/${safe}/pro/dashboard`);
}
