export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const { assertServiceRoleOnStartup } = await import(
        "@/lib/supabase/service-health"
      );
      assertServiceRoleOnStartup();
    }
  } catch (error) {
    console.error("[instrumentation] register failed:", error);
  }
}
