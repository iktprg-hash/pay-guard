"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast-provider";

/** Shows toast after Stripe Checkout redirect (?checkout=success|cancelled). */
export function CheckoutResultToast() {
  const searchParams = useSearchParams();
  const t = useTranslations("pricing");

  useEffect(() => {
    const result = searchParams.get("checkout");
    if (!result) return;

    if (result === "success") {
      toast(t("checkoutSuccess"), "success");
    } else if (result === "cancelled") {
      toast(t("checkoutCancelled"), "default");
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [searchParams, t]);

  return null;
}
