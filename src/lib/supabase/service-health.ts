import { createServiceClient } from "@/lib/supabase/service";
import { isUpstashRateLimitConfigured } from "@/lib/security/rateLimit";

export class ServiceRoleMissingError extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY is required in production");
    this.name = "ServiceRoleMissingError";
  }
}

export class UpstashMissingError extends Error {
  constructor() {
    super(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production"
    );
    this.name = "UpstashMissingError";
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
    throw new ServiceRoleMissingError();
  }
}

let upstashChecked = false;

export function assertUpstashOnStartup(): void {
  if (upstashChecked) return;
  upstashChecked = true;

  if (process.env.NODE_ENV !== "production") return;

  if (!isUpstashRateLimitConfigured()) {
    throw new UpstashMissingError();
  }
}
