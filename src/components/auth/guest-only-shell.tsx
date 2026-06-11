import type { ReactNode } from "react";
import { redirectIfAuthenticated } from "@/lib/auth/server-page-guard";
import type { Locale } from "@/i18n/routing";

/** Login / register / forgot-password — jen pro nepřihlášené */
export async function GuestOnlyShell({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  await redirectIfAuthenticated(locale);
  return children;
}
