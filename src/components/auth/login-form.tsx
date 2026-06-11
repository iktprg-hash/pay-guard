"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import { mapAuthCodeToMessage, type AuthErrorCode } from "@/lib/auth/errors";
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

function friendlyAuthError(
  reason: string | null,
  t: (key: string) => string
): string | null {
  if (!reason) return t("errors.generic");
  const decoded = decodeURIComponent(reason);
  if (decoded.includes("PKCE") || decoded.includes("code verifier")) {
    return t("errors.pkceHint");
  }
  return mapAuthCodeToMessage(decoded as AuthErrorCode, t);
}

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const next = resolveAuthNext(searchParams.get("next"), locale);
  const authError = searchParams.get("error");
  const authReason = searchParams.get("reason");

  const [tab, setTab] = useState<Tab>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    authError === "auth" ? friendlyAuthError(authReason, t) : null
  );

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as {
        error?: string;
        code?: AuthErrorCode;
      };

      setLoading(false);

      if (!res.ok) {
        setError(mapAuthCodeToMessage(data.code, t, data.error));
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
          <CardTitle className="text-2xl">{t("loginTitle")}</CardTitle>
          <CardDescription>{t("loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="flex gap-2 rounded-lg bg-muted/50 p-1"
            role="tablist"
            aria-label={t("loginTitle")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "password"}
              onClick={() => {
                setTab("password");
                setError(null);
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
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Link
                    href={`/${locale}/forgot-password`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t("forgotPasswordLink")}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("signIn")}
              </Button>
            </form>
          ) : (
            <EmailCodeForm onSuccess={() => {
              window.location.href = next;
            }} />
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
            {t("noAccount")}{" "}
            <Link
              href={`/${locale}/register?next=${encodeURIComponent(next)}`}
              className="font-medium text-primary hover:underline"
            >
              {t("registerLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
