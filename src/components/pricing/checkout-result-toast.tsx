"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast-provider";

/** After Stripe Checkout: confirm/sync Pro and show toast. */
export function CheckoutResultToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  }, [searchParams, t, tToast, router]);

  return null;
}
