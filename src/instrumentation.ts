export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertServiceRoleOnStartup } = await import(
      "@/lib/supabase/service-health"
    );
    assertServiceRoleOnStartup();
  }
}
