#!/usr/bin/env node
/**
 * Production deploy checklist for Pay Guard.
 * Usage: npm run prod:checklist
 *        npm run prod:checklist -- --strict   (exit 1 on any blocker)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getProjectRef, loadEnvLocal } from "./load-env-local.mjs";
import { pgSslConfig } from "./pg-ssl.mjs";
import { verifyMigrations } from "./verify-migrations.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

const strict = process.argv.includes("--strict");
const ref = getProjectRef();
let blockers = 0;
let warnings = 0;

function pass(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  warnings += 1;
  console.log(`⚠️  ${msg}`);
}

function fail(msg) {
  blockers += 1;
  console.log(`❌ ${msg}`);
}

function env(name) {
  const v = process.env[name] ?? "";
  return v.replace(/^["']|["']$/g, "").trim();
}

function isPlaceholder(v) {
  return !v || v.includes("your-") || v.includes("xxx") || v === "your_xai_api_key";
}

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Pay Guard — Production checklist                            ║
╚══════════════════════════════════════════════════════════════╝
`);

// ── Migrations files ──
console.log("── Migrations (files) ──");
const migDir = join(root, "supabase/migrations");
const requiredMigs = [
  "001_initial_schema.sql",
  "002_session_token.sql",
  "003_auth_profile.sql",
  "004_session_sync.sql",
  "005_normalize_debts.sql",
  "006_protect_subscription_tier.sql",
  "007_grok_consent.sql",
  "008_stripe_billing.sql",
];

if (!existsSync(migDir)) {
  fail("supabase/migrations/ missing");
} else {
  const files = readdirSync(migDir);
  for (const name of requiredMigs) {
    if (files.includes(name)) pass(`${name} present`);
    else fail(`${name} missing`);
  }
}

console.log("\n── Migrations (applied in Supabase) ──");
const dbUrl = env("DATABASE_URL");
let migrationsVerified = false;

if (dbUrl && !dbUrl.includes("[PASSWORD]")) {
  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: dbUrl, ssl: pgSslConfig(dbUrl) });
    await client.connect();
    const { rows } = await client.query(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'financial_sessions'
      and column_name in ('session_token', 'updated_at')
    `);
    await client.end();
    const cols = new Set(rows.map((r) => r.column_name));
    if (cols.has("session_token") && cols.has("updated_at")) {
      pass("DB has session_token + updated_at (002+004 applied via DATABASE_URL)");
      migrationsVerified = true;
    } else {
      fail(
        `DB missing columns: ${["session_token", "updated_at"].filter((c) => !cols.has(c)).join(", ")} — run npm run db:apply`
      );
    }
  } catch (err) {
    warn(
      `DATABASE_URL check failed (${err instanceof Error ? err.message : err}) — trying service role verify…`
    );
  }
}

if (!migrationsVerified) {
  const result = await verifyMigrations();
  if (result.message) {
    warn(result.message);
  } else if (result.ok) {
    pass("All migrations 001–006 verified via Supabase API");
    migrationsVerified = true;
  } else {
    const missing = result.checks.filter((c) => !c.ok).map((c) => c.label);
    fail(`Missing in DB: ${missing.join(", ")} — run npm run db:apply or SQL Editor`);
    if (ref) {
      console.log(`   → https://supabase.com/dashboard/project/${ref}/sql/new`);
    }
    console.log("   Or: npm run db:hint");
  }
}

// ── Upstash ──
console.log("\n── Upstash (rate limits in production) ──");
const upstashUrl = env("UPSTASH_REDIS_REST_URL");
const upstashToken = env("UPSTASH_REDIS_REST_TOKEN");
if (isPlaceholder(upstashUrl) || isPlaceholder(upstashToken)) {
  fail("UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN required for production");
} else {
  pass("Upstash env vars set");
  console.log("   Run: npm run verify:upstash");
}

// ── Supabase core ──
console.log("\n── Supabase ──");
const supaUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

if (isPlaceholder(supaUrl)) fail("NEXT_PUBLIC_SUPABASE_URL not configured");
else pass("NEXT_PUBLIC_SUPABASE_URL set");

if (isPlaceholder(anonKey)) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY not configured");
else pass("NEXT_PUBLIC_SUPABASE_ANON_KEY set");

if (isPlaceholder(serviceKey)) fail("SUPABASE_SERVICE_ROLE_KEY required (claim + anon sessions)");
else pass("SUPABASE_SERVICE_ROLE_KEY set");

// ── Dev bypass must be OFF in prod ──
console.log("\n── Security env ──");
if (env("AUTH_DEV_REGISTER") === "1") {
  if (process.env.NODE_ENV === "production") {
    fail("AUTH_DEV_REGISTER=1 must be UNSET in production (.env / Vercel)");
  } else {
    warn(
      "AUTH_DEV_REGISTER=1 in .env.local — OK for local dev; do NOT add to Vercel production env"
    );
  }
} else {
  pass("AUTH_DEV_REGISTER not enabled");
}

if (env("AUTH_SKIP_RATE_LIMIT") === "1") {
  fail("AUTH_SKIP_RATE_LIMIT=1 must be UNSET in production");
} else {
  pass("AUTH_SKIP_RATE_LIMIT not enabled");
}

if (process.env.NODE_ENV !== "production") {
  warn("NODE_ENV is not production locally — Vercel sets this automatically");
}

// ── XAI ──
console.log("\n── xAI (optional demo without key) ──");
if (isPlaceholder(env("XAI_API_KEY"))) {
  warn("XAI_API_KEY missing — app runs in demo/mock mode");
} else {
  pass("XAI_API_KEY set");
}

console.log("\n── Site URL (production) ──");
const siteUrl = env("NEXT_PUBLIC_SITE_URL");
if (siteUrl && !siteUrl.includes("your-")) {
  pass(`NEXT_PUBLIC_SITE_URL=${siteUrl}`);
  console.log("   Run: npm run domain:setup");
} else if (process.env.VERCEL_URL) {
  pass(`VERCEL_URL=${process.env.VERCEL_URL} (auto)`);
} else {
  warn("NEXT_PUBLIC_SITE_URL not set — run npm run domain:setup after Vercel deploy");
}

// ── Manual Supabase dashboard ──
console.log("\n── Manual (Supabase Dashboard) ──");
const authUrl = ref
  ? `https://supabase.com/dashboard/project/${ref}/auth/providers`
  : "Supabase Dashboard → Authentication";
const smtpUrl = ref
  ? `https://supabase.com/dashboard/project/${ref}/auth/templates`
  : "Supabase Dashboard → Auth → Email";

console.log(`📋 Confirm email: ON (production)`);
console.log(`   ${authUrl}`);
console.log(`📋 Custom SMTP configured (recommended for OTP / reset password)`);
console.log(`   ${smtpUrl}`);
console.log(`📋 Site URL + Redirect URLs include your production domain + /auth/confirm`);
console.log(`📋 Rate limits reviewed (Authentication → Rate Limits)`);
console.log(`📋 Lokální DB záloha: npm run db:backup → ~/PayGuard-backups (cron na Macu, viz README)`);

console.log("\n── Stripe (Pro billing, Czech market) ──");
const stripeKey = env("STRIPE_SECRET_KEY");
const stripePrice = env("STRIPE_PRO_PRICE_ID");
const stripeWebhook = env("STRIPE_WEBHOOK_SECRET");
if (isPlaceholder(stripeKey) || isPlaceholder(stripePrice) || isPlaceholder(stripeWebhook)) {
  warn("Stripe not fully configured — Pro checkout disabled (STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, STRIPE_WEBHOOK_SECRET)");
} else {
  pass("Stripe env vars set");
  console.log("   Webhook URL: https://<your-domain>/api/webhooks/stripe");
  console.log("   Create CZK monthly Price in Stripe Dashboard → STRIPE_PRO_PRICE_ID");
}

// ── Summary ──
console.log("\n── Summary ──");
console.log(`Blockers: ${blockers}  Warnings: ${warnings}`);

if (blockers > 0) {
  console.log("\n❌ Fix blockers before production deploy.");
  process.exit(strict || blockers > 0 ? 1 : 0);
}

if (warnings > 0) {
  console.log("\n⚠️  Review warnings — deploy possible but not ideal.");
} else {
  console.log("\n✅ All automated checks passed.");
}

process.exit(strict && warnings > 0 ? 1 : 0);
