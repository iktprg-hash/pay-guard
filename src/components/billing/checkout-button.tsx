"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-provider";
import { apiFetch } from "@/lib/api/client-fetch";
import { AppError } from "@/lib/errors/app-error";
import { getUserErrorMessageFromError } from "@/lib/errors";

function isAlreadyProStripeError(error: unknown): boolean {
  return (
    error instanceof AppError &&
    error.details !== null &&
    typeof error.details === "object" &&
    "stripeCode" in error.details &&
    (error.details as { stripeCode?: string }).stripeCode === "already_pro"
  );
}
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
      const data = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
        locale,
      });

      window.location.href = data.url;
    } catch (err) {
      if (isAlreadyProStripeError(err)) {
        toast(t("alreadyPro"), "default");
        return;
      }
      toast(getUserErrorMessageFromError(err, locale), "error");
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
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
        locale,
      });
      window.location.href = data.url;
    } catch (err) {
      toast(getUserErrorMessageFromError(err, locale), "error");
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
