"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Mail } from "lucide-react";
import { mapAuthCodeToMessage, type AuthErrorCode } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailCodeFormProps {
  onSuccess: () => void;
  submitLabel?: string;
  onSupabaseRateLimit?: () => void;
}

export function EmailCodeForm({ onSuccess, submitLabel, onSupabaseRateLimit }: EmailCodeFormProps) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as { error?: string; code?: AuthErrorCode };
      setLoading(false);

      if (!res.ok) {
        const message = mapAuthCodeToMessage(data.code, t, data.error);
        setError(message);
        if (
          data.code === "supabase_email_rate_limited" ||
          data.error?.toLowerCase().includes("email rate limit")
        ) {
          onSupabaseRateLimit?.();
        }
        return;
      }

      setOtpSent(true);
      setMessage(t("emailCodeSent"));
    } catch {
      setLoading(false);
      setError(t("errors.network"));
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, token: otpCode.trim() }),
      });

      const data = (await res.json()) as { error?: string; code?: AuthErrorCode };
      setLoading(false);

      if (!res.ok) {
        setError(mapAuthCodeToMessage(data.code, t, data.error));
        return;
      }

      onSuccess();
    } catch {
      setLoading(false);
      setError(t("errors.network"));
    }
  };

  return (
    <form
      onSubmit={otpSent ? handleVerify : handleSend}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="otp-email">{t("email")}</Label>
        <Input
          id="otp-email"
          type="email"
          autoComplete="email"
          required
          disabled={otpSent}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {otpSent && (
        <div className="space-y-2">
          <Label htmlFor="otp-code">{t("emailCodeLabel")}</Label>
          <Input
            id="otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            required
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-muted-foreground">{t("emailCodeHint")}</p>
        </div>
      )}
      <Button
        type="submit"
        variant="secondary"
        className="w-full gap-2"
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {otpSent ? t("verifyEmailCode") : (submitLabel ?? t("sendEmailCode"))}
      </Button>
      {otpSent && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-sm"
          onClick={() => {
            setOtpSent(false);
            setOtpCode("");
            setMessage(null);
          }}
        >
          {t("useDifferentEmail")}
        </Button>
      )}
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
    </form>
  );
}
