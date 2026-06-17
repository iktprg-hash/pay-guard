import { setRequestLocale } from "next-intl/server";
import { ConsultationDetailView } from "@/components/consultations/consultation-detail-view";
import { generateConsultationDetailMetadata } from "@/lib/seo/pro-page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale } = await params;
  return generateConsultationDetailMetadata(locale);
}

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);
  return <ConsultationDetailView sessionId={sessionId} />;
}
