import { setRequestLocale } from "next-intl/server";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { PricingPageClient } from "@/components/billing/pricing-page-client";
import type { Locale } from "@/i18n/routing";

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { locale } = await params;
  const { checkout, session_id } = await searchParams;
  setRequestLocale(locale);

  const billingEnabled = isStripeBillingConfigured();

  return (
    <PricingPageClient
      locale={locale as Locale}
      billingEnabled={billingEnabled}
      checkoutResult={checkout as "success" | "cancelled" | undefined}
      sessionId={session_id}
    />
  );
}
