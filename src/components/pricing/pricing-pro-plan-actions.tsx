"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CheckoutButton,
  ManageSubscriptionButton,
} from "@/components/billing/checkout-button";
import { Button } from "@/components/ui/button";
import { useProAccess } from "@/hooks/use-pro-access";
import type { Locale } from "@/i18n/routing";

interface PricingProPlanActionsProps {
  locale: Locale;
  billingEnabled: boolean;
}

/** Pro plan CTA — checkout for Free, portal for active Pro (E2E + pricing UX). */
export function PricingProPlanActions({
  locale,
  billingEnabled,
}: PricingProPlanActionsProps) {
  const t = useTranslations("pricing");
  const { isProEnabled: pro, loading: tierLoading } = useProAccess();

  if (tierLoading) {
    return (
      <Button className="w-full" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("startCheckout")}
      </Button>
    );
  }

  if (pro && billingEnabled) {
    return <ManageSubscriptionButton locale={locale} className="w-full" />;
  }

  return (
    <CheckoutButton
      locale={locale}
      billingEnabled={billingEnabled}
      className="w-full"
    />
  );
}
