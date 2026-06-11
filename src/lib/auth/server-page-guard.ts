import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/session";
import type { Locale } from "@/i18n/routing";

/** Server-side auth pro protected route group */
export async function requirePageUser(locale: Locale): Promise<void> {
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }
}

/** Přesměruje přihlášené uživatele z login/register */
export async function redirectIfAuthenticated(locale: Locale): Promise<void> {
  const user = await getServerUser();
  if (user) {
    redirect(`/${locale}`);
  }
}
