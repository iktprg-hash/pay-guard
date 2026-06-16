"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast-provider";
import {
  applyCheckoutSubscriptionUpdate,
  subscriptionTierKeys,
} from "@/hooks/use-pro-access";
import { proFinancialKeys } from "@/hooks/useProFinancial";

/** After Stripe Checkout: confirm/sync Pro, unlock gates, and show toast. */
export function CheckoutResultToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("pricing");
  const tToast = useTranslations("toast");
  const handled = useRef(false);

  useEffect(() => {
    const result = searchParams.get("checkout");
    if (!result || handled.current) return;
    handled.current = true;

    const sessionId = searchParams.get("session_id");

    const cleanupUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + url.search);
    };

    if (result === "cancelled") {
      toast(t("checkoutCancelled"), "default");
      cleanupUrl();
      return;
    }

    if (result !== "success") return;

    void (async () => {
      toast(t("checkoutActivating"), "default");

      try {
        const endpoint = sessionId
          ? "/api/billing/confirm"
          : "/api/billing/sync";
        const body = sessionId
          ? JSON.stringify({ sessionId })
          : undefined;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          credentials: "include",
          body,
        });

        if (res.ok) {
          const data = (await res.json()) as {
            tier?: "pro" | "pro_max" | "free";
            expiresAt?: string | null;
          };
          const tier =
            data.tier === "pro_max"
              ? "pro_max"
              : data.tier === "pro"
                ? "pro"
                : "pro";

          applyCheckoutSubscriptionUpdate(
            queryClient,
            tier,
            data.expiresAt ?? null
          );
          void queryClient.invalidateQueries({
            queryKey: proFinancialKeys.all,
          });
          await queryClient.refetchQueries({
            queryKey: subscriptionTierKeys.all,
          });

          toast(t("checkoutSuccess"), "success");
          router.refresh();
        } else {
          const data = (await res.json()) as { detail?: string; code?: string };
          toast(data.detail ?? tToast("syncFailed"), "error");
        }
      } catch {
        toast(tToast("syncFailed"), "error");
      } finally {
        cleanupUrl();
      }
    })();
  }, [searchParams, t, tToast, router, queryClient]);

  return null;
}
