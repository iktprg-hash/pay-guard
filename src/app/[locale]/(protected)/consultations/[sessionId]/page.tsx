import { setRequestLocale } from "next-intl/server";
import { ConsultationDetail } from "@/components/consultations/consultation-detail";
import { getUserSubscription } from "@/lib/auth/subscription";
import { getServerUser } from "@/lib/auth/session";
import { generateConsultationDetailMetadata } from "@/lib/seo/pro-page-metadata";
import { isPaidTier } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

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

  const user = await getServerUser();
  const subscription = user
    ? await getUserSubscription(user.id)
    : { tier: "free" as const, expiresAt: null };
  const isPro = isPaidTier(subscription.tier);

  return (
    <main>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <ConsultationDetail
          sessionId={sessionId}
          locale={locale as Locale}
          isPro={isPro}
        />
      </div>
    </main>
  );
}
