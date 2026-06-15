import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

let browserClient: SupabaseClient | undefined;

export function isSupabaseBrowserConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

/** Supabase klient pro browser — singleton, PKCE cookies přes @supabase/ssr */
export function createClient(): SupabaseClient | null {
  if (browserClient) return browserClient;

  const config = getSupabasePublicConfig();
  if (!config) return null;

  browserClient = createBrowserClient(config.url, config.anonKey);

  return browserClient;
}
