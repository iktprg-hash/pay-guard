#!/usr/bin/env node
/**
 * Backfill subscription_expires_at for paid tiers missing expiry (Fix 3 deploy prep).
 *
 * Uses Supabase service role (REST) by default — no DATABASE_URL required.
 * Optional: --use-pg to force Postgres when DATABASE_URL is valid.
 *
 * Usage:
 *   npm run fix:subscription-expires:dry
 *   npm run fix:subscription-expires
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { loadEnvLocal } from "./load-env-local.mjs";
import { pgSslConfig } from "./pg-ssl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

const dryRun = process.argv.includes("--dry-run");
const forcePg = process.argv.includes("--use-pg");

const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

function getPeriodEnd(subscription) {
  const itemEnd = subscription.items?.data?.[0]?.current_period_end;
  if (itemEnd) return itemEnd;
  if (subscription.cancel_at) return subscription.cancel_at;
  return null;
}

function env(name) {
  return (process.env[name] ?? "").replace(/^["']|["']$/g, "").trim();
}

async function createSupabaseDb() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey || url.includes("your-project")) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  const { createSupabaseAdminClient } = await import("./supabase-node-client.mjs");
  const supabase = await createSupabaseAdminClient(url, serviceKey);

  return {
    kind: "supabase",
    async fetchNullExpires() {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, subscription_tier, subscription_expires_at, stripe_customer_id, stripe_subscription_id"
        )
        .in("subscription_tier", ["pro", "pro_max"])
        .is("subscription_expires_at", null);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async updateProfile(id, patch) {
      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_expires_at: patch.expiresAt,
          stripe_subscription_id: patch.stripeSubscriptionId,
          updated_at: patch.updatedAt,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    async close() {},
  };
}

async function createPgDb() {
  const databaseUrl = env("DATABASE_URL");
  if (!databaseUrl || databaseUrl.includes("[PASSWORD]")) {
    return null;
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: pgSslConfig(databaseUrl),
    connectionTimeoutMillis: 15_000,
  });

  try {
    await client.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  Postgres unavailable (${msg}) — using Supabase API`);
    return null;
  }

  return {
    kind: "pg",
    async fetchNullExpires() {
      const { rows } = await client.query(
        `SELECT id, subscription_tier, subscription_expires_at,
                stripe_customer_id, stripe_subscription_id
         FROM profiles
         WHERE subscription_tier IN ('pro', 'pro_max')
           AND subscription_expires_at IS NULL`
      );
      return rows;
    },
    async updateProfile(id, patch) {
      await client.query(
        `UPDATE profiles
         SET subscription_expires_at = $1,
             stripe_subscription_id = COALESCE($2, stripe_subscription_id),
             updated_at = $3
         WHERE id = $4`,
        [patch.expiresAt, patch.stripeSubscriptionId, patch.updatedAt, id]
      );
    },
    async close() {
      await client.end();
    },
  };
}

async function createDb() {
  if (forcePg) {
    const pgDb = await createPgDb();
    if (pgDb) return pgDb;
    throw new Error("--use-pg set but DATABASE_URL connection failed");
  }

  return createSupabaseDb();
}

async function main() {
  const stripeKey = env("STRIPE_SECRET_KEY");
  if (!stripeKey || stripeKey.includes("sk_test_xxx")) {
    console.error("Missing STRIPE_SECRET_KEY in .env.local");
    process.exit(1);
  }

  const stripe = new Stripe(stripeKey);
  const db = await createDb();

  console.log(`Using ${db.kind} connection`);

  const rows = await db.fetchNullExpires();

  console.log(
    `\n${dryRun ? "[DRY RUN] " : ""}Found ${rows.length} paid profile(s) with null subscription_expires_at\n`
  );

  if (rows.length === 0) {
    console.log("Nothing to fix.");
    await db.close();
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of rows) {
    const label = `${profile.id} (${profile.subscription_tier})`;
    try {
      let subscription = null;

      if (profile.stripe_subscription_id) {
        subscription = await stripe.subscriptions.retrieve(
          profile.stripe_subscription_id
        );
      } else if (profile.stripe_customer_id) {
        const listed = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: "all",
          limit: 20,
        });
        subscription =
          listed.data.find((sub) => PRO_STATUSES.has(sub.status)) ?? null;
      }

      if (!subscription || !PRO_STATUSES.has(subscription.status)) {
        console.log(`⚠️  SKIP ${label} — no active Stripe subscription`);
        skipped += 1;
        continue;
      }

      const periodEnd = getPeriodEnd(subscription);
      if (!periodEnd) {
        console.log(
          `⚠️  SKIP ${label} — Stripe sub ${subscription.id} has no period end`
        );
        skipped += 1;
        continue;
      }

      const expiresAt = new Date(periodEnd * 1000).toISOString();
      console.log(
        `${dryRun ? "→ would update" : "✅ updating"} ${label} → expires ${expiresAt} (sub ${subscription.id})`
      );

      if (!dryRun) {
        await db.updateProfile(profile.id, {
          expiresAt,
          stripeSubscriptionId: subscription.id,
          updatedAt: new Date().toISOString(),
        });
      }

      fixed += 1;
    } catch (err) {
      console.error(`❌ FAIL ${label}:`, err instanceof Error ? err.message : err);
      failed += 1;
    }
  }

  await db.close();

  console.log(
    `\nDone: ${fixed} fixed, ${skipped} skipped, ${failed} failed${dryRun ? " (dry run)" : ""}\n`
  );

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
