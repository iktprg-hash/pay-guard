import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";

/** Uloží / aktualizuje locale v profiles po přihlášení */
export async function syncUserProfileLocale(
  userId: string,
  locale: Locale
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("profiles").upsert(
      {
        id: userId,
        locale,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    // Profil se vytvoří triggerem — ignorujeme selhání sync
  }
}

/** Načte locale z profilu */
export async function getUserProfileLocale(
  userId: string
): Promise<Locale | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .maybeSingle();
    const locale = data?.locale;
    if (locale === "cs" || locale === "ru" || locale === "en") return locale;
    return null;
  } catch {
    return null;
  }
}
