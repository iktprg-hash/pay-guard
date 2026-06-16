"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useProAccess } from "@/hooks/use-pro-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast-provider";
import type { StripeBillingConfigIssue } from "@/lib/billing/config";
import type { Locale } from "@/i18n/routing";

const ISSUE_I18N_KEY: Record<StripeBillingConfigIssue, string> = {
  missing_secret_key: "billingIssueMissingSecret",
  placeholder_secret_key: "billingIssuePlaceholderSecret",
  invalid_secret_key: "billingIssueInvalidSecret",
  missing_price_id: "billingIssueMissingPrice",
  placeholder_price_id: "billingIssuePlaceholderPrice",
  product_id_not_price: "billingIssueProductNotPrice",
  invalid_price_id: "billingIssueInvalidPrice",
  missing_webhook_secret: "billingIssueMissingWebhook",
};

interface PricingActionsProps {
  checkoutEnabled: boolean;
  checkoutBlocker: StripeBillingConfigIssue | null;
  webhookConfigured: boolean;
}

export function PricingActions({
  checkoutEnabled,
  checkoutBlocker,
  webhookConfigured,
}: PricingActionsProps) {
  const t = useTranslations("pricing");
  const tBilling = useTranslations("billing");
  const tToast = useTranslations("toast");
  const locale = useLocale() as Locale;
  const { user, loading: authLoading } = useAuth();
  const { isProEnabled: pro, loading: tierLoading } = useProAccess();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const loading = authLoading || tierLoading;

  const startCheckout = async () => {
    if (!user || !checkoutEnabled) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale }),
      });

      const data = (await res.json()) as {
        url?: string;
        error?: string;
        detail?: string;
        code?: string;
      };

      if (res.status === 401) {
        toast(t("loginToUpgrade"), "default");
        return;
      }

      if (res.status === 409) {
        toast(t("alreadyPro"), "default");
        return;
      }

      if (res.status === 503 && data.code === "billing_not_configured") {
        toast(data.detail ?? t("billingNotConfigured"), "error");
        return;
      }

      if (!res.ok || !data.url) {
        toast(data.detail ?? data.error ?? tToast("checkoutFailed"), "error");
        return;
      }

      window.location.href = data.url;
    } catch {
      toast(tToast("checkoutFailed"), "error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale }),
      });
      const data = (await res.json()) as { url?: string; detail?: string };
      if (!res.ok || !data.url) {
        toast(data.detail ?? tToast("portalFailed"), "error");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast(tToast("portalFailed"), "error");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <Button className="mt-6 w-full" disabled aria-busy="true">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        {t("upgrade")}
      </Button>
    );
  }

  if (pro) {
    return (
      <div className="mt-6 space-y-3">
        <Badge className="w-full justify-center py-2 text-sm">
          {t("proActive")}
        </Badge>
        {checkoutEnabled && (
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={portalLoading}
            onClick={() => void openPortal()}
            aria-label={tBilling("manage")}
          >
            {portalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden />
            )}
            {tBilling("manage")}
          </Button>
        )}
      </div>
    );
  }

  if (!checkoutEnabled) {
    const issueKey = checkoutBlocker
      ? ISSUE_I18N_KEY[checkoutBlocker]
      : "billingNotConfigured";
    return (
      <div className="mt-6 space-y-2">
        <Button className="w-full" disabled>
          {t("upgrade")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t(issueKey)}</p>
      </div>
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
    <div className="mt-6 space-y-2">
      {!webhookConfigured && (
        <p className="text-center text-xs text-amber-600 dark:text-amber-400">
          {t("billingIssueMissingWebhook")}
        </p>
      )}
      <Button
        className="w-full"
        disabled={checkoutLoading}
        aria-busy={checkoutLoading}
        onClick={() => void startCheckout()}
      >
        {checkoutLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {t("redirecting")}
          </>
        ) : (
          t("upgrade")
        )}
      </Button>
    </div>
  );
}
