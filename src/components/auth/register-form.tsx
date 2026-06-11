"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import { mapAuthCodeToMessage, type AuthErrorCode } from "@/lib/auth/errors";
import { isStrongPassword } from "@/lib/auth/password";
import { resolveAuthNext } from "@/lib/auth/redirect";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";

type Tab = "password" | "emailCode";

export function RegisterForm() {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const next = resolveAuthNext(searchParams.get("next"), locale);

  const [tab, setTab] = useState<Tab>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isStrongPassword(password)) {
      setError(t("errors.passwordRequirements"));
      return;
    }
    if (password !== confirm) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, locale }),
      });

      const data = (await res.json()) as {
        code?: AuthErrorCode;
        error?: string;
        needsEmailConfirmation?: boolean;
      };

      setLoading(false);

      if (!res.ok) {
        setError(mapAuthCodeToMessage(data.code, t, data.error));
        return;
      }

      if (data.needsEmailConfirmation) {
        setMessage(t("confirmEmail"));
        return;
      }

      window.location.href = next;
    } catch {
      setLoading(false);
      setError(t("errors.network"));
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-0px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t("registerTitle")}</CardTitle>
          <CardDescription>{t("registerSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="flex gap-2 rounded-lg bg-muted/50 p-1"
            role="tablist"
            aria-label={t("registerTitle")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "password"}
              onClick={() => {
                setTab("password");
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === "password"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("passwordTab")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "emailCode"}
              onClick={() => {
                setTab("emailCode");
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === "emailCode"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("emailCodeTab")}
            </button>
          </div>

          {tab === "password" ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-email">{t("email")}</Label>
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">{t("password")}</Label>
                <Input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("passwordRequirementsHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-confirm">{t("confirmPassword")}</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("signUp")}
              </Button>
            </form>
          ) : (
            <>
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                {t("emailCodeDevHint")}
              </p>
              <EmailCodeForm
                submitLabel={t("registerWithEmailCode")}
                onSupabaseRateLimit={() => {
                  setTab("password");
                  setError(t("errors.supabaseEmailRateLimited"));
                }}
                onSuccess={() => {
                  window.location.href = next;
                }}
              />
            </>
          )}

          {message && (
            <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
              {message}
            </p>
          )}
          {error && tab === "password" && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link
              href={`/${locale}/login?next=${encodeURIComponent(next)}`}
              className="font-medium text-primary hover:underline"
            >
              {t("loginLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
