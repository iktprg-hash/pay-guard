import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireServiceClient } from "@/lib/supabase/service-health";

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("your-project"));
}

async function getDbClient() {
  if (process.env.NODE_ENV === "production") {
    return requireServiceClient();
  }
  return createServiceClient() ?? (await createClient());
}

/**
 * Ověří, že sessionId + sessionToken patří k sobě.
 * V dev bez Supabase stačí délka tokenu.
 */
export async function validateSessionToken(
  sessionId: string,
  sessionToken: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return sessionToken.length >= 32;
  }

  try {
    const supabase = await getDbClient();
    if (!supabase) return false;

    const { data, error } = await supabase
      .from("financial_sessions")
      .select("session_token")
      .eq("id", sessionId)
      .maybeSingle();

    if (error || !data) return false;
    return data.session_token === sessionToken;
  } catch {
    return false;
  }
}

/**
 * Zaregistruje novou relaci s tokenem (při prvním uložení).
 * Pokud relace existuje, ověří shodu tokenu.
 */
export async function registerSession(
  sessionId: string,
  sessionToken: string,
  userId?: string | null
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const supabase = await getDbClient();
    if (!supabase) return false;

    const { error } = await supabase.from("financial_sessions").insert({
      id: sessionId,
      session_token: sessionToken,
      user_id: userId ?? null,
      profile_data: {},
    });

    if (error?.code === "23505") {
      return validateSessionToken(sessionId, sessionToken);
    }

    return !error;
  } catch {
    return false;
  }
}
