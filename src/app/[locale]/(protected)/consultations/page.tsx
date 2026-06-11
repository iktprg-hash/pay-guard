import { setRequestLocale } from "next-intl/server";
import { SessionList } from "@/components/consultations/session-list";

export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SessionList />;
}
