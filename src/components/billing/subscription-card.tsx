"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
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
import type { Locale } from "@/i18n/routing";

interface SubscriptionCardProps {
  billingEnabled: boolean;
}

export function SubscriptionCard({ billingEnabled }: SubscriptionCardProps) {
  const t = useTranslations("billing");
  const tToast = useTranslations("toast");
  const locale = useLocale() as Locale;
  const { user, loading: authLoading } = useAuth();
  const { pro, loading: tierLoading } = useSubscriptionTier();
  const [portalLoading, setPortalLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/auth/tier", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { expiresAt?: string | null } | null) => {
        if (data?.expiresAt) setExpiresAt(data.expiresAt);
      })
      .catch(() => {});
  }, [user]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale }),
      });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) {
        toast(tToast("portalFailed"), "error");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast(tToast("portalFailed"), "error");
    } finally {
      setPortalLoading(false);
    }
  };

  if (authLoading || tierLoading) {
    return null;
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("loginHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="secondary">
            <Link href={`/${locale}/login?next=/${locale}/settings`}>
              {t("login")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>
          {pro ? t("proDescription") : t("freeDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={pro ? "default" : "secondary"}>
            {pro ? t("planPro") : t("planFree")}
          </Badge>
          {pro && expiresAt && (
            <span className="text-xs text-muted-foreground">
              {t("renewsAt", {
                date: new Date(expiresAt).toLocaleDateString(
                  locale === "cs" ? "cs-CZ" : locale === "ru" ? "ru-RU" : "en-GB"
                ),
              })}
            </span>
          )}
        </div>

        {!pro && billingEnabled && (
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/${locale}/pricing`}>{t("upgrade")}</Link>
          </Button>
        )}

        {pro && billingEnabled && (
          <Button
            variant="outline"
            className="gap-2 w-full sm:w-auto"
            disabled={portalLoading}
            onClick={() => void openPortal()}
          >
            {portalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {t("manage")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
