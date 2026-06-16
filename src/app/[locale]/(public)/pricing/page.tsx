import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStripeBillingConfigStatus } from "@/lib/billing/config";
import { PricingActions } from "@/components/pricing/pricing-actions";
import { FreePlanBadge } from "@/components/pricing/free-plan-badge";
import { CheckoutResultToast } from "@/components/pricing/checkout-result-toast";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");
  const billing = getStripeBillingConfigStatus();

  const freeFeatures = t.raw("freeFeatures") as string[];
  const proFeatures = t.raw("proFeatures") as string[];

  return (
    <div className="mx-auto max-w-4xl flex-1 px-4 py-12">
      <Suspense fallback={null}>
        <CheckoutResultToast />
      </Suspense>
      <h1 className="mb-8 text-center text-3xl font-bold">{t("title")}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t("free")}
              <span className="text-2xl font-bold">{t("freePrice")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <FreePlanBadge />
          </CardContent>
        </Card>

        <Card className="border-primary shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {t("pro")}
                <Badge>{t("pro")}</Badge>
              </span>
              <span className="text-2xl font-bold text-primary">{t("proPrice")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <PricingActions
              checkoutEnabled={billing.checkoutEnabled}
              checkoutBlocker={billing.checkoutBlocker}
              webhookConfigured={billing.webhookConfigured}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
