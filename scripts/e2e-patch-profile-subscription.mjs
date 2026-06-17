#!/usr/bin/env node
/**
 * Patch profiles.subscription_* for E2E when PostgREST trigger guard blocks REST updates.
 * Usage: node scripts/e2e-patch-profile-subscription.mjs <userId> <tier> [expiresAt ISO]
 */
import { loadEnvLocal } from "./load-env-local.mjs";
import { pgSslConfig } from "./pg-ssl.mjs";

loadEnvLocal(process.cwd());

const [userId, tier, expiresAtArg] = process.argv.slice(2);
const locale = process.env.E2E_LOCALE ?? "cs";

if (!userId || !tier) {
  console.error(
    "Usage: node scripts/e2e-patch-profile-subscription.mjs <userId> <tier> [expiresAt]"
  );
  process.exit(1);
}

const expiresAt =
  expiresAtArg === "null" || expiresAtArg === undefined ? null : expiresAtArg;

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || databaseUrl.includes("[PASSWORD]")) {
  console.error("DATABASE_URL is required for pg subscription patch");
  process.exit(2);
}

const { default: pg } = await import("pg");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: pgSslConfig(databaseUrl),
});

await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "ALTER TABLE public.profiles DISABLE TRIGGER trg_guard_profile_subscription"
  );
  await client.query(
    `INSERT INTO public.profiles (id, locale, subscription_tier, subscription_expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       subscription_tier = EXCLUDED.subscription_tier,
       subscription_expires_at = EXCLUDED.subscription_expires_at,
       updated_at = now()`,
    [userId, locale, tier, expiresAt]
  );
  await client.query(
    "ALTER TABLE public.profiles ENABLE TRIGGER trg_guard_profile_subscription"
  );
  const { rows } = await client.query(
    `SELECT subscription_tier, subscription_expires_at
     FROM public.profiles
     WHERE id = $1`,
    [userId]
  );
  await client.query("COMMIT");
  process.stdout.write(JSON.stringify(rows[0] ?? null));
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
