"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { resolveAuthNext } from "@/lib/auth/redirect";
import { getAuthConfirmCopy } from "@/lib/pwa/static-messages";
import type { Locale } from "@/i18n/routing";

/** Potvrzení e-mailu / PKCE — session cookies nastaví server */
export function AuthConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (searchParams.get("locale") ?? "cs") as Locale;
  const copy = getAuthConfirmCopy(locale);
  const [message, setMessage] = useState(copy.confirmSigningIn);

  useEffect(() => {
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const next = searchParams.get("next");
    const strings = getAuthConfirmCopy(locale);

    const fail = (reason: string) => {
      router.replace(
        `/${locale}/login?error=auth&reason=${encodeURIComponent(reason)}`
      );
    };

    const succeed = () => {
      const target = resolveAuthNext(next, locale);
      window.location.href = target;
    };

    async function run() {
      try {
        let body: Record<string, string>;

        if (tokenHash && type) {
          setMessage(strings.confirmVerifyingEmail);
          body = { token_hash: tokenHash, type };
        } else if (code) {
          setMessage(strings.confirmCompletingSignIn);
          body = { code };
        } else {
          fail("Missing auth code");
          return;
        }

        const res = await fetch("/api/auth/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string; code?: string };
          fail(data.error ?? data.code ?? "Auth failed");
          return;
        }

        succeed();
      } catch (err) {
        fail(err instanceof Error ? err.message : "Auth failed");
      }
    }

    void run();
  }, [router, searchParams, locale]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
        <Shield className="h-6 w-6 text-primary" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
