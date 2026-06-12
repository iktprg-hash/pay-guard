#!/usr/bin/env node
/**
 * Verify Supabase migrations 001–006 via service role (no DATABASE_URL needed).
 * Usage: npm run db:verify
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getProjectRef, loadEnvLocal } from "./load-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

function env(name) {
  return (process.env[name] ?? "").replace(/^["']|["']$/g, "").trim();
}

const VERIFY_TIMEOUT_MS = 12_000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function verifyMigrations() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const ref = getProjectRef();

  if (!url || !key || url.includes("your-project")) {
    return {
      ok: false,
      checks: [],
      message: "Supabase URL or service role key missing in .env.local",
    };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const probes = [
    { id: "001", label: "financial_sessions table", table: "financial_sessions", columns: "id" },
    { id: "001", label: "profiles table", table: "profiles", columns: "locale" },
    { id: "002", label: "session_token column", table: "financial_sessions", columns: "session_token" },
    { id: "004", label: "updated_at column", table: "financial_sessions", columns: "updated_at" },
    { id: "004", label: "chat_messages.metadata", table: "chat_messages", columns: "metadata" },
    { id: "005", label: "debts.creditor_name", table: "debts", columns: "creditor_name" },
    { id: "005", label: "debts.user_id", table: "debts", columns: "user_id" },
    { id: "005", label: "debts.priority_level", table: "debts", columns: "priority_level" },
    {
      id: "006",
      label: "guard_profile_subscription trigger",
      table: "profiles",
      columns: "subscription_tier",
    },
    {
      id: "008",
      label: "profiles.stripe_customer_id",
      table: "profiles",
      columns: "stripe_customer_id",
    },
  ];

  const checks = await Promise.all(
    probes.map(async (probe) => {
      try {
        const { error } = await withTimeout(
          admin.from(probe.table).select(probe.columns).limit(1),
          VERIFY_TIMEOUT_MS,
          probe.label
        );
        const missing =
          error &&
          (error.message.includes("does not exist") ||
            error.message.includes("Could not find") ||
            error.code === "PGRST204" ||
            error.code === "42703");
        return {
          migration: probe.id,
          label: probe.label,
          ok: !error || !missing,
          detail: error?.message,
        };
      } catch (err) {
        return {
          migration: probe.id,
          label: probe.label,
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  const ok = checks.every((c) => c.ok);
  return { ok, checks, ref };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Pay Guard — migration verify (001–006)          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const result = await verifyMigrations();

  if (result.message) {
    console.log(`❌ ${result.message}`);
    process.exit(1);
  }

  for (const c of result.checks) {
    console.log(`${c.ok ? "✅" : "❌"} [${c.migration}] ${c.label}`);
    if (!c.ok && c.detail) console.log(`   ${c.detail}`);
  }

  console.log("");
  if (result.ok) {
    console.log("✅ All migration checks passed.");
    process.exit(0);
  }

  console.log("❌ Missing migrations. Apply in order:");
  console.log(`   https://supabase.com/dashboard/project/${result.ref}/sql/new`);
  console.log("   Or: set DATABASE_URL in .env.local → npm run db:apply");
  console.log("   Hint: npm run db:hint");
  process.exit(1);
}

export { verifyMigrations };

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
