import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Sentry — должен быть первым
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  // Prod startup sanity checks
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const { assertServiceRoleOnStartup, assertUpstashOnStartup } = await import(
    "@/lib/supabase/service-health"
  );
  assertServiceRoleOnStartup();
  assertUpstashOnStartup();
}

export const onRequestError = Sentry.captureRequestError;
