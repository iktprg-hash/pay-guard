import { createClient } from "@/lib/supabase/server";
import { unauthorizedError } from "@/lib/api/errors";
import type { User } from "@supabase/supabase-js";

/** Vrátí přihlášeného uživatele nebo null */
export async function getServerUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/** Vyžaduje auth v API route — vrátí 401 response nebo user */
export async function requireApiUser(): Promise<
  { user: User } | { error: Response }
> {
  const user = await getServerUser();
  if (!user) {
    return { error: unauthorizedError("Authentication required") };
  }
  return { user };
}
