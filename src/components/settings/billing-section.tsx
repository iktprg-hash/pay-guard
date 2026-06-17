"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import {
  CheckoutButton,
  ManageSubscriptionButton,
} from "@/components/billing/checkout-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast-provider";
import { formatDate } from "@/lib/utils";
import { isPaidTier, type SubscriptionTier } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

interface BillingSectionProps {
  locale: Locale;
  initialTier: SubscriptionTier;
  initialExpiresAt: string | null;
  billingEnabled: boolean;
}

export function BillingSection({
  locale,
  initialTier,
  initialExpiresAt,
  billingEnabled,
}: BillingSectionProps) {
  const t = useTranslations("billing");
  const tToast = useTranslations("toast");
  const [tier, setTier] = useState(initialTier);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [syncLoading, setSyncLoading] = useState(false);

  const pro = isPaidTier(tier);

  const syncSubscription = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/billing/sync", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = (await res.json()) as {
          tier?: SubscriptionTier;
          expiresAt?: string | null;
        };
        if (data.tier) setTier(data.tier);
        if (data.expiresAt !== undefined) setExpiresAt(data.expiresAt);
        toast(t("syncSuccess"), "success");
        return;
      }

      toast(tToast("proSaveFailed"), "error");
    } catch {
      toast(tToast("proSaveFailed"), "error");
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          {t("title")}
        </CardTitle>
        <CardDescription>
          {pro ? t("proDescription") : t("freeDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={pro ? "default" : "secondary"}>
            {pro ? t("planPro") : t("planFree")}
          </Badge>
          {pro && expiresAt ? (
            <span className="text-xs text-muted-foreground">
              {t("renewsAt", { date: formatDate(expiresAt, locale) })}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {pro ? (
            <ManageSubscriptionButton locale={locale} className="w-full sm:w-auto" />
          ) : billingEnabled ? (
            <CheckoutButton
              locale={locale}
              billingEnabled
              className="w-full sm:w-auto"
            />
          ) : null}

          {billingEnabled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
              disabled={syncLoading}
              onClick={() => void syncSubscription()}
            >
              {syncLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("syncSubscription")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
