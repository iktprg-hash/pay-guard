"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Shield } from "lucide-react";
import { mapAuthCodeToMessage, type AuthErrorCode } from "@/lib/auth/errors";
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

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
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

      setMessage(t("forgotPasswordSent"));
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
          <CardTitle className="text-2xl">{t("forgotPasswordTitle")}</CardTitle>
          <CardDescription>{t("forgotPasswordSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("sendResetLink")}
            </Button>
          </form>

          {message && (
            <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link
              href={`/${locale}/login`}
              className="font-medium text-primary hover:underline"
            >
              {t("backToLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
