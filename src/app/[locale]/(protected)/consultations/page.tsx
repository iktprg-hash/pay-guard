import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConsultationList } from "@/components/consultations/consultation-list";
import { Button } from "@/components/ui/button";
import { getUserSubscription } from "@/lib/auth/subscription";
import { getServerUser } from "@/lib/auth/session";
import { getConsultationsPageMetadata } from "@/lib/seo/pro-page-metadata";
import { isPaidTier } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

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

  const t = await getTranslations("consultations");
  const user = await getServerUser();
  const subscription = user
    ? await getUserSubscription(user.id)
    : { tier: "free" as const, expiresAt: null };
  const isPro = isPaidTier(subscription.tier);
  const safeLocale = locale as Locale;

  return (
    <main>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Button asChild>
            <Link href={`/${safeLocale}`}>{t("newConsultation")}</Link>
          </Button>
        </div>

        <ConsultationList locale={safeLocale} isPro={isPro} />
      </div>
    </main>
  );
}
