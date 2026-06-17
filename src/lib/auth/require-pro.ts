import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { respondWithError } from "@/lib/errors";
import { getServerUser, requireApiUser } from "@/lib/auth/session";
import { userHasProAccess } from "@/lib/auth/subscription";
import type { Locale } from "@/i18n/routing";

/** API — vyžaduje Pro tier */
export async function requireProApiUser(): Promise<
  { user: User } | { error: Response }
> {
  const auth = await requireApiUser();
  if ("error" in auth) return auth;

  const pro = await userHasProAccess(auth.user.id);
  if (!pro) {
    return { error: respondWithError("PRO_REQUIRED") };
  }

  return { user: auth.user };
}

/** Stránka — redirect na pricing bez Pro */
export async function requireProPageUser(locale: Locale): Promise<User> {
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const pro = await userHasProAccess(user.id);
  if (!pro) {
    redirect(`/${locale}/pricing`);
  }

  return user;
}
