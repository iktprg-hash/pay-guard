#!/usr/bin/env node
/**
 * Verify Stripe webhook endpoint + STRIPE_WEBHOOK_SECRET alignment (live/test mode).
 * Usage: npm run verify:webhook
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { loadEnvLocal } from "./load-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

const PRODUCTION_URL =
  "https://pay-guard-murex-alpha.vercel.app/api/webhooks/stripe";
const REQUIRED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

function env(name) {
  return (process.env[name] ?? "").trim();
}

function mask(secret) {
  if (!secret) return "(missing)";
  if (secret.length < 12) return "whsec_…";
  return `${secret.slice(0, 10)}…${secret.slice(-4)} (len ${secret.length})`;
}

const key = env("STRIPE_SECRET_KEY");
const webhookSecret = env("STRIPE_WEBHOOK_SECRET");
const mode = key.startsWith("sk_live_")
  ? "live"
  : key.startsWith("sk_test_")
    ? "test"
    : "unknown";

console.log(`
╔══════════════════════════════════════════════════╗
║  Pay Guard — Stripe webhook verify               ║
╚══════════════════════════════════════════════════╝
`);

console.log(`Stripe mode (from STRIPE_SECRET_KEY): ${mode}`);
console.log(`Local STRIPE_WEBHOOK_SECRET: ${mask(webhookSecret)}`);

if (!webhookSecret.startsWith("whsec_")) {
  console.log("\n❌ STRIPE_WEBHOOK_SECRET must start with whsec_");
  process.exit(1);
}

if (webhookSecret.length < 20) {
  console.log("\n⚠️  Secret looks too short — copy full Signing secret from Dashboard");
}

const stripe = new Stripe(key);
const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });

console.log(`\nWebhook endpoints in Stripe (${mode} mode): ${endpoints.data.length}`);

const prodMatches = endpoints.data.filter((ep) => ep.url === PRODUCTION_URL);

if (endpoints.data.length === 0) {
  console.log(`
❌ No webhook endpoints in ${mode} mode.

Create one in Stripe Dashboard (toggle ${mode.toUpperCase()} at top):
  URL: ${PRODUCTION_URL}
  Events: ${REQUIRED_EVENTS.join(", ")}

Then copy Signing secret → Vercel STRIPE_WEBHOOK_SECRET → Redeploy.
`);
  process.exit(1);
}

for (const ep of endpoints.data) {
  const marker = ep.url === PRODUCTION_URL ? " ← production" : "";
  console.log(`\n• ${ep.status} ${ep.url}${marker}`);
  console.log(`  id: ${ep.id}`);
  const missing = REQUIRED_EVENTS.filter((e) => !ep.enabled_events.includes(e));
  if (missing.length) {
    console.log(`  ⚠️  Missing events: ${missing.join(", ")}`);
  } else {
    console.log(`  ✅ Required events subscribed`);
  }
}

if (prodMatches.length === 0) {
  console.log(`
❌ Production endpoint not found in ${mode} mode:
   ${PRODUCTION_URL}

Your whsec_ must come from THIS endpoint (Reveal signing secret), not from stripe listen CLI.
`);
  process.exit(1);
}

console.log(`
✅ Production webhook endpoint exists in ${mode} mode.

Important:
1. STRIPE_WEBHOOK_SECRET on Vercel must match Signing secret of that endpoint (not CLI whsec).
2. After changing Vercel env → Redeploy (not just save).
3. In Stripe → Webhooks → endpoint → Recent deliveries: check for 400/500 errors.

Probe production (no signature):
`);

try {
  const res = await fetch(PRODUCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const text = await res.text();
  if (res.status === 503) {
    console.log(`❌ HTTP 503 — STRIPE_WEBHOOK_SECRET missing on Vercel (or redeploy needed)`);
  } else if (res.status === 404) {
    console.log(`❌ HTTP 404 — route not on production (Vercel deploy failed or old build)`);
    console.log(`   Fix: Vercel → Deployments → open failed build → copy error from Build Logs`);
    console.log(`   Or promote last successful deployment until build is fixed`);
  } else if (res.status === 400) {
    console.log(`✅ HTTP 400 — webhook route live, secret configured (signature rejected as expected)`);
  } else {
    console.log(`⚠️  HTTP ${res.status} — ${text.slice(0, 120)}`);
  }
} catch (err) {
  console.log(`⚠️  Could not reach production: ${err.message}`);
}

console.log("");
