/**
 * Supabase admin client for Node scripts (db:verify, backups, prod checklist).
 * Node.js < 22 needs explicit ws transport — realtime-js no longer auto-imports ws.
 */
export async function createSupabaseAdminClient(url, key) {
  const { createClient } = await import("@supabase/supabase-js");
  const options = {
    auth: { autoRefreshToken: false, persistSession: false },
  };

  if (typeof globalThis.WebSocket === "undefined") {
    const ws = await import("ws");
    options.realtime = { transport: ws.default ?? ws };
  }

  return createClient(url, key, options);
}
