import { createClient } from "@/lib/supabase/server";

/** Whether the user has recorded server-side Grok consent. */
export async function getUserGrokConsent(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("grok_consent_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data?.grok_consent_at) return false;
    return true;
  } catch {
    return false;
  }
}

/** Records Grok consent on the user's profile (idempotent). */
export async function setUserGrokConsent(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        grok_consent_at: now,
        updated_at: now,
      },
      { onConflict: "id" }
    );
    return !error;
  } catch {
    return false;
  }
}
