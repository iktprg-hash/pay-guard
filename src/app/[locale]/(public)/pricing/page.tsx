import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Sparkles } from "lucide-react";
import { CheckoutStatusHandler } from "@/components/pricing/checkout-status-handler";
import { PricingProPlanActions } from "@/components/pricing/pricing-pro-plan-actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStripeBillingConfigStatus } from "@/lib/billing/config";
import type { Locale } from "@/i18n/routing";

function parseCheckoutParam(
  value: string | string[] | undefined
): "success" | "cancelled" | null {
  if (value === "success" || value === "cancelled") return value;
  return null;
}

function parseSessionId(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const safeLocale = locale as Locale;
  const checkout = parseCheckoutParam(query.checkout);
  const sessionId = parseSessionId(query.session_id);

  if (checkout === "success" || checkout === "cancelled") {
    return (
      <CheckoutStatusHandler
        checkout={checkout}
        sessionId={sessionId}
        locale={safeLocale}
      />
    );
  }

  const t = await getTranslations("pricing");
  const billing = getStripeBillingConfigStatus();
  const freeFeatures = t.raw("freeFeatures") as string[];
  const proFeatures = t.raw("proFeatures") as string[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-10 space-y-3 text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("freePlanName")}</CardTitle>
            <CardDescription>{t("freePlanDescription")}</CardDescription>
            <div className="mt-2">
              <span className="text-3xl font-bold">{t("freePrice")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                {t("proPlanName")}
              </CardTitle>
              <Badge>{t("popularBadge")}</Badge>
            </div>
            <CardDescription>{t("proPlanDescription")}</CardDescription>
            <div className="mt-2">
              <span className="text-3xl font-bold">{t("proPrice")}</span>
              <span className="ml-1 text-sm text-muted-foreground">
                {t("proPricePeriod")}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            <PricingProPlanActions
              locale={safeLocale}
              billingEnabled={billing.checkoutEnabled}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
