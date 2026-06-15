/** Shared Supabase public config checks (server + browser). */

const PLACEHOLDER_MARKERS = ["your-project", "your_anon_key"] as const;

export function stripEnvQuotes(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) => value.includes(marker));
}

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/** Returns Supabase URL + anon key when configured, otherwise null. */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = stripEnvQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = stripEnvQuotes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey)) {
    return null;
  }

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

export const SUPABASE_ENV_HINT =
  "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.local.example).";
