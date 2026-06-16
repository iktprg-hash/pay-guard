"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import {
  applyCheckoutSubscriptionUpdate,
  subscriptionTierKeys,
} from "@/hooks/use-pro-access";
import { proFinancialKeys } from "@/hooks/useProFinancial";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";

const CONFIRM_MAX_ATTEMPTS = 5;
const CONFIRM_RETRY_MS = 3_000;
const SUCCESS_REDIRECT_MS = 2_000;

type FlowPhase =
  | "idle"
  | "activating"
  | "processing"
  | "success"
  | "error"
  | "cancelled";

async function confirmCheckout(sessionId: string): Promise<{
  ok: boolean;
  code?: string;
  error?: string;
  tier?: "pro" | "pro_max" | "free";
  expiresAt?: string | null;
}> {
  const res = await fetch("/api/billing/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sessionId }),
  });

  const data = (await res.json()) as {
    pro?: boolean;
    tier?: "pro" | "pro_max" | "free";
    expiresAt?: string | null;
    code?: string;
    error?: string;
  };

  if (res.ok && data.pro) {
    return {
      ok: true,
      tier: data.tier ?? "pro",
      expiresAt: data.expiresAt ?? null,
    };
  }

  return {
    ok: false,
    code: data.code,
    error: data.error,
  };
}

async function syncSubscriptionFallback(): Promise<{
  ok: boolean;
  tier?: "pro" | "pro_max" | "free";
  expiresAt?: string | null;
}> {
  const res = await fetch("/api/billing/sync", {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) return { ok: false };

  const data = (await res.json()) as {
    pro?: boolean;
    tier?: "pro" | "pro_max" | "free";
    expiresAt?: string | null;
  };

  return data.pro
    ? { ok: true, tier: data.tier ?? "pro", expiresAt: data.expiresAt ?? null }
    : { ok: false };
}

/** Handles Stripe checkout redirect: confirm Pro, retry, redirect to dashboard. */
export function CheckoutFlowHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const t = useTranslations("pricing");
  const checkout = searchParams.get("checkout");
  const sessionId = searchParams.get("session_id");

  const [phase, setPhase] = useState<FlowPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const started = useRef(false);

  const clearCheckoutParams = useCallback(() => {
    router.replace(`/${locale}/pricing`);
  }, [locale, router]);

  const stripSessionId = useCallback(() => {
    router.replace(`/${locale}/pricing?checkout=success`);
  }, [locale, router]);

  const applyProUnlock = useCallback(
    async (tier: "pro" | "pro_max" | "free" = "pro", expiresAt: string | null = null) => {
      applyCheckoutSubscriptionUpdate(queryClient, tier, expiresAt);
      void queryClient.invalidateQueries({ queryKey: proFinancialKeys.all });
      await queryClient.refetchQueries({ queryKey: subscriptionTierKeys.all });
    },
    [queryClient]
  );

  useEffect(() => {
    if (checkout === "cancelled") {
      setPhase("cancelled");
      return;
    }

    if (checkout !== "success") {
      setPhase("idle");
      return;
    }

    if (started.current) return;

    const sid = sessionId;
    if (sid) {
      const storageKey = `pg-checkout-confirm:${sid}`;
      if (sessionStorage.getItem(storageKey)) {
        setPhase("success");
        return;
      }
      sessionStorage.setItem(storageKey, "1");
    }

    started.current = true;

    void (async () => {
      setPhase("activating");

      if (sid) {
        stripSessionId();
      }

      const activate = async (): Promise<boolean> => {
        if (sid) {
          for (let attempt = 1; attempt <= CONFIRM_MAX_ATTEMPTS; attempt++) {
            const result = await confirmCheckout(sid);

            if (result.ok) {
              const tier =
                result.tier === "pro_max"
                  ? "pro_max"
                  : result.tier === "pro"
                    ? "pro"
                    : "pro";
              await applyProUnlock(tier, result.expiresAt ?? null);
              setPhase("success");
              window.setTimeout(() => {
                router.push(`/${locale}/pro/dashboard`);
              }, SUCCESS_REDIRECT_MS);
              return true;
            }

            if (result.code === "session_incomplete" && attempt < CONFIRM_MAX_ATTEMPTS) {
              setPhase("processing");
              await new Promise((resolve) =>
                window.setTimeout(resolve, CONFIRM_RETRY_MS)
              );
              setPhase("activating");
              continue;
            }

            setErrorMessage(result.error ?? t("pro.syncFailed"));
            setPhase("error");
            return false;
          }
          return false;
        }

        const synced = await syncSubscriptionFallback();
        if (synced.ok) {
          const tier =
            synced.tier === "pro_max"
              ? "pro_max"
              : synced.tier === "pro"
                ? "pro"
                : "pro";
          await applyProUnlock(tier, synced.expiresAt ?? null);
          setPhase("success");
          window.setTimeout(() => {
            router.push(`/${locale}/pro/dashboard`);
          }, SUCCESS_REDIRECT_MS);
          return true;
        }

        setErrorMessage(t("pro.syncFailed"));
        setPhase("error");
        return false;
      };

      await activate();
    })();
  }, [
    checkout,
    sessionId,
    locale,
    router,
    stripSessionId,
    applyProUnlock,
    t,
  ]);

  if (phase === "idle") return null;

  if (phase === "cancelled") {
    return (
      <div
        className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-4 text-center"
        role="status"
      >
        <p className="text-sm text-muted-foreground">{t("pro.cancelled")}</p>
        <Button
          className="mt-3"
          variant="secondary"
          size="sm"
          onClick={() => {
            setPhase("idle");
            clearCheckoutParams();
          }}
        >
          {t("pro.retryBtn")}
        </Button>
      </div>
    );
  }

  if (phase === "activating" || phase === "processing") {
    return (
      <div
        className="mb-6 flex items-center justify-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium">
          {phase === "processing" ? t("pro.processing") : t("pro.activating")}
        </p>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div
        className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-4 text-center"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
        <p className="text-sm font-medium text-green-800 dark:text-green-200">
          {t("pro.activated")}
        </p>
      </div>
    );
  }

  if (phase === "error") {
    const supportEmail =
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@payguard.app";

    return (
      <div
        className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-4 text-center"
        role="alert"
      >
        <div className="flex items-center justify-center gap-2 text-destructive">
          <XCircle className="h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={clearCheckoutParams}>
            {t("pro.retryBtn")}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`mailto:${supportEmail}`}>
              <Mail className="mr-2 h-4 w-4" aria-hidden />
              {t("pro.errorContact")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
