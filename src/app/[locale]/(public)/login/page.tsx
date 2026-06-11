import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { GuestOnlyShell } from "@/components/auth/guest-only-shell";
import type { Locale } from "@/i18n/routing";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <GuestOnlyShell locale={locale as Locale}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </GuestOnlyShell>
  );
}
