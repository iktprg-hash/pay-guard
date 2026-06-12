#!/usr/bin/env node
/**
 * Verify Stripe billing env + price + checkout session (local .env.local).
 * Usage: npm run verify:stripe
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { loadEnvLocal } from "./load-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

function env(name) {
  return (process.env[name] ?? "").trim();
}

const key = env("STRIPE_SECRET_KEY");
const priceId = env("STRIPE_PRO_PRICE_ID");
const webhook = env("STRIPE_WEBHOOK_SECRET");

console.log(`
╔══════════════════════════════════════════════════╗
║  Pay Guard — Stripe verify                       ║
╚══════════════════════════════════════════════════╝
`);

function fail(msg) {
  console.log(`❌ ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.log(`⚠️  ${msg}`);
}

if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
  fail("STRIPE_SECRET_KEY missing or invalid (must start with sk_test_ or sk_live_)");
}
pass(`STRIPE_SECRET_KEY (${key.startsWith("sk_test_") ? "test" : "live"})`);

if (!priceId.startsWith("price_")) {
  if (priceId.startsWith("prod_")) {
    fail(
      "STRIPE_PRO_PRICE_ID is a Product id (prod_…). Copy Price id (price_…) from Stripe → Product → Pricing"
    );
  }
  fail("STRIPE_PRO_PRICE_ID must start with price_");
}
pass("STRIPE_PRO_PRICE_ID format");

if (!webhook.startsWith("whsec_")) {
  warn("STRIPE_WEBHOOK_SECRET missing — checkout works, but Pro won't activate after payment");
} else {
  pass("STRIPE_WEBHOOK_SECRET set");
}

const stripe = new Stripe(key);

let price;
try {
  price = await stripe.prices.retrieve(priceId);
} catch (err) {
  fail(
    `Cannot load price (check Test/Live mode matches secret key): ${err.message}`
  );
}

if (!price.active) fail(`Price ${priceId} is inactive in Stripe`);
if (price.type !== "recurring") fail(`Price ${priceId} must be recurring (subscription)`);
pass(`Price loaded: ${price.currency.toUpperCase()} / ${price.recurring?.interval}`);

try {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: "http://127.0.0.1:3000/cs/pricing?checkout=success",
    cancel_url: "http://127.0.0.1:3000/cs/pricing?checkout=cancelled",
    customer_email: "verify-stripe@example.com",
  });
  if (!session.url) fail("Checkout session created but no URL returned");
  pass("Checkout session creates successfully");
} catch (err) {
  fail(`Checkout session failed: ${err.message}`);
}

console.log("\n✅ Stripe is ready locally. Copy the same 3 vars to Vercel → Redeploy.\n");
