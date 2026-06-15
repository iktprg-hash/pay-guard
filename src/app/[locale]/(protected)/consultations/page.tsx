import { setRequestLocale } from "next-intl/server";
import { ConsultationsView } from "@/components/consultations/consultations-view";
import { getConsultationsPageMetadata } from "@/lib/seo/pro-page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return getConsultationsPageMetadata(locale);
}

export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ConsultationsView />;
}
