import { createServiceClient } from "@/lib/supabase/service";

export class ServiceRoleMissingError extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY is required in production");
    this.name = "ServiceRoleMissingError";
  }
}

export function isServiceRoleConfigured(): boolean {
  return createServiceClient() !== null;
}

/** Fail closed in production when service role is missing */
export function requireServiceClient() {
  const client = createServiceClient();
  if (!client && process.env.NODE_ENV === "production") {
    throw new ServiceRoleMissingError();
  }
  return client;
}

let startupChecked = false;

export function assertServiceRoleOnStartup(): void {
  if (startupChecked) return;
  startupChecked = true;

  if (process.env.NODE_ENV !== "production") return;

  if (!isServiceRoleConfigured()) {
    console.error(
      "[pay-guard] CRITICAL: SUPABASE_SERVICE_ROLE_KEY missing — claim/session token ops will fail"
    );
  }
}
