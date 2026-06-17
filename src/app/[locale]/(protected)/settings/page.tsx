import { setRequestLocale } from "next-intl/server";
import { SettingsPanel } from "@/components/pwa/SettingsPanel";
import { BillingSection } from "@/components/settings/billing-section";
import { getServerUser } from "@/lib/auth/session";
import { getStripeBillingConfigStatus } from "@/lib/billing/config";
import { getSubscriptionStatus } from "@/lib/stripe";
import type { Locale } from "@/i18n/routing";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getServerUser();
  const billing = getStripeBillingConfigStatus();
  const status = user
    ? await getSubscriptionStatus(user.id)
    : { tier: "free" as const, expiresAt: null };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <SettingsPanel
        subscriptionSlot={
          user ? (
            <BillingSection
              locale={locale as Locale}
              initialTier={status.tier}
              initialExpiresAt={status.expiresAt}
              billingEnabled={billing.checkoutEnabled}
            />
          ) : null
        }
      />
    </div>
  );
}
