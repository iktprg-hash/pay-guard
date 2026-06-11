/** Prod startup sanity check — dynamic import avoids cold-start import graph issues */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const { assertServiceRoleOnStartup } = await import(
    "@/lib/supabase/service-health"
  );
  assertServiceRoleOnStartup();
}
