"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-provider";
import type { Locale } from "@/i18n/routing";

interface CheckoutButtonProps {
  locale: Locale;
  billingEnabled: boolean;
  className?: string;
}

export function CheckoutButton({
  locale,
  billingEnabled,
  className,
}: CheckoutButtonProps) {
  const t = useTranslations("pricing");
  const tToast = useTranslations("toast");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      router.push(`/${locale}/login?next=/${locale}/pricing`);
      return;
    }

    setLoading(true);
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
        code?: string;
      };

      if (!res.ok || !data.url) {
        if (
          data.code === "BILLING_ALREADY_PRO" ||
          data.code === "already_pro"
        ) {
          toast(t("alreadyPro"), "default");
          return;
        }
        toast(tToast("checkoutFailed"), "error");
        return;
      }

      window.location.href = data.url;
    } catch {
      toast(tToast("checkoutFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  if (!billingEnabled) return null;

  return (
    <Button
      className={className}
      disabled={loading || authLoading}
      onClick={() => void handleCheckout()}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {user ? t("startCheckout") : t("loginToCheckout")}
    </Button>
  );
}

interface ManageSubscriptionButtonProps {
  locale: Locale;
  className?: string;
}

export function ManageSubscriptionButton({
  locale,
  className,
}: ManageSubscriptionButtonProps) {
  const t = useTranslations("billing");
  const tToast = useTranslations("toast");
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className={className}
      disabled={loading}
      onClick={() => void openPortal()}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="mr-2 h-4 w-4" />
      )}
      {t("manage")}
    </Button>
  );
}
