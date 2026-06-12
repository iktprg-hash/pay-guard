import { setRequestLocale } from "next-intl/server";
import { SettingsPanel } from "@/components/pwa/SettingsPanel";
import { SubscriptionCard } from "@/components/billing/subscription-card";
import { isStripeBillingConfigured } from "@/lib/billing/config";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const billingEnabled = isStripeBillingConfigured();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <SettingsPanel
        subscriptionSlot={
          <SubscriptionCard billingEnabled={billingEnabled} />
        }
      />
    </div>
  );
}
