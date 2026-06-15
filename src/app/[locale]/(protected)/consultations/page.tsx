import { setRequestLocale } from "next-intl/server";
import { ConsultationsView } from "@/components/consultations/consultations-view";

export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ConsultationsView />;
}
