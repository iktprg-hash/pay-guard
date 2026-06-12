"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast-provider";
import type { Locale } from "@/i18n/routing";

interface PricingActionsProps {
  billingEnabled: boolean;
}

export function PricingActions({ billingEnabled }: PricingActionsProps) {
  const t = useTranslations("pricing");
  const tToast = useTranslations("toast");
  const locale = useLocale() as Locale;
  const { user, loading: authLoading } = useAuth();
  const { pro, loading: tierLoading } = useSubscriptionTier();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const loading = authLoading || tierLoading;

  const startCheckout = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (res.status === 409) {
        toast(t("alreadyPro"), "default");
        return;
      }

      if (!res.ok || !data.url) {
        toast(tToast("checkoutFailed"), "error");
        return;
      }

      window.location.href = data.url;
    } catch {
      toast(tToast("checkoutFailed"), "error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <Button className="mt-6 w-full" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("upgrade")}
      </Button>
    );
  }

  if (pro) {
    return (
      <Badge className="mt-6 w-full justify-center py-2 text-sm">
        {t("proActive")}
      </Badge>
    );
  }

  if (!billingEnabled) {
    return (
      <Button className="mt-6 w-full" disabled>
        {t("upgrade")} — {t("comingSoon")}
      </Button>
    );
  }

  if (!user) {
    return (
      <Button className="mt-6 w-full" asChild>
        <Link href={`/${locale}/login?next=/${locale}/pricing`}>
          {t("loginToUpgrade")}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      className="mt-6 w-full"
      disabled={checkoutLoading}
      onClick={() => void startCheckout()}
    >
      {checkoutLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("redirecting")}
        </>
      ) : (
        t("upgrade")
      )}
    </Button>
  );
}
