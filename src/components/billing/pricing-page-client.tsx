"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, Loader2, Sparkles, Check } from "lucide-react";
import {
  applyCheckoutSubscriptionUpdate,
  useProAccess,
} from "@/hooks/use-pro-access";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckoutButton,
  ManageSubscriptionButton,
} from "@/components/billing/checkout-button";
import type { Locale } from "@/i18n/routing";
import type { SubscriptionTier } from "@/lib/types/financial";

interface PricingPageClientProps {
  locale: Locale;
  billingEnabled: boolean;
  checkoutResult?: "success" | "cancelled";
  sessionId?: string;
}

type ConfirmState = "idle" | "confirming" | "confirmed" | "error";

export function PricingPageClient({
  locale,
  billingEnabled,
  checkoutResult,
  sessionId,
}: PricingPageClientProps) {
  const t = useTranslations("pricing");
  const queryClient = useQueryClient();
  const { isProEnabled: pro, loading: tierLoading } = useProAccess();
  const [confirmState, setConfirmState] = useState<ConfirmState>("idle");
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (checkoutResult !== "success" || !sessionId || confirmedRef.current) {
      return;
    }
    confirmedRef.current = true;

    const confirm = async () => {
      setConfirmState("confirming");
      try {
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            tier?: SubscriptionTier;
            expiresAt?: string | null;
          };
          applyCheckoutSubscriptionUpdate(
            queryClient,
            data.tier ?? "pro",
            data.expiresAt ?? null
          );
          setConfirmState("confirmed");
        } else {
          applyCheckoutSubscriptionUpdate(queryClient);
          setConfirmState("confirmed");
        }
      } catch {
        applyCheckoutSubscriptionUpdate(queryClient);
        setConfirmState("confirmed");
      }
    };

    void confirm();
  }, [checkoutResult, sessionId, queryClient]);

  if (checkoutResult === "success") {
    if (confirmState === "confirming" || confirmState === "idle") {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("confirmingPayment")}</p>
        </div>
      );
    }

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <CheckCircle2 className="h-14 w-14 text-green-500" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t("successTitle")}</h1>
          <p className="text-muted-foreground">{t("successDescription")}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/settings`}>{t("goToSettings")}</Link>
        </Button>
      </div>
    );
  }

  if (checkoutResult === "cancelled") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <XCircle className="h-14 w-14 text-muted-foreground" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t("cancelledTitle")}</h1>
          <p className="text-muted-foreground">{t("cancelledDescription")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <CheckoutButton locale={locale} billingEnabled={billingEnabled} />
          <Button variant="outline" asChild>
            <Link href={`/${locale}/pricing`}>{t("tryAgain")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/settings`}>{t("goToSettings")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const proFeatures: string[] = t.raw("proFeatures") as string[];

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
              {(t.raw("freeFeatures") as string[]).map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
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
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            {tierLoading ? (
              <Button className="w-full" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("startCheckout")}
              </Button>
            ) : pro && billingEnabled ? (
              <ManageSubscriptionButton locale={locale} className="w-full" />
            ) : (
              <CheckoutButton
                locale={locale}
                billingEnabled={billingEnabled}
                className="w-full"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
