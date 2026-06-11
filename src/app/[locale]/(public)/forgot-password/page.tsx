import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { GuestOnlyShell } from "@/components/auth/guest-only-shell";
import type { Locale } from "@/i18n/routing";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <GuestOnlyShell locale={locale as Locale}>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </GuestOnlyShell>
  );
}
