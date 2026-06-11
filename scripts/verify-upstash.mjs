#!/usr/bin/env node
/**
 * Ověření Upstash Redis pro Pay Guard rate limits.
 * Usage: node scripts/verify-upstash.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./load-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

const url = stripQuotes(process.env.UPSTASH_REDIS_REST_URL ?? "");
const token = stripQuotes(process.env.UPSTASH_REDIS_REST_TOKEN ?? "");

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  Pay Guard — Upstash verification                ║");
console.log("╚══════════════════════════════════════════════════╝\n");

let ok = true;

if (!url || !token) {
  console.log("❌ UPSTASH_REDIS_REST_URL nebo TOKEN chybí v .env.local");
  process.exit(1);
}

if (url.includes("your-") || url.includes("xxx")) {
  console.log("❌ UPSTASH_REDIS_REST_URL vypadá jako placeholder");
  ok = false;
}

if (!url.startsWith("https://")) {
  console.log(`❌ URL musí začínat https:// (máte: ${url.slice(0, 20)}…)`);
  ok = false;
}

if (url.startsWith('"') || token.startsWith('"')) {
  console.log("⚠️  Hodnoty v .env.local mají uvozovky — odstraňte je:");
  console.log('   UPSTASH_REDIS_REST_URL=https://….upstash.io');
  console.log("   (ne \"https://…\")");
}

console.log(`✓ URL nastavena: ${url.replace(/^(https:\/\/[^.]+).*/, "$1…")}`);
console.log(`✓ Token délka: ${token.length} znaků\n`);

try {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token });

  const ping = await redis.ping();
  if (ping !== "PONG") {
    console.log(`❌ Redis ping: ${ping}`);
    ok = false;
  } else {
    console.log("✓ Redis PING → PONG");
  }

  const testKey = `payguard:verify:${Date.now()}`;
  await redis.set(testKey, "ok", { ex: 60 });
  const val = await redis.get(testKey);
  if (val !== "ok") {
    console.log("❌ Redis SET/GET selhalo");
    ok = false;
  } else {
    console.log("✓ Redis SET/GET funguje");
    await redis.del(testKey);
  }

  const { Ratelimit } = await import("@upstash/ratelimit");
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 m"),
    prefix: "payguard:rl:verify",
  });

  const key = `test-${Date.now()}`;
  let blocked = false;
  for (let i = 0; i < 5; i++) {
    const r = await limiter.limit(key);
    if (!r.success) blocked = true;
  }
  if (!blocked) {
    console.log("⚠️  Rate limiter neblokoval po 5 pokusech (limit 3) — zkontrolujte konfiguraci");
  } else {
    console.log("✓ @upstash/ratelimit blokuje po překročení limitu");
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : "";
  console.log(`❌ Upstash chyba: ${msg}${cause ? ` (${cause})` : ""}`);
  if (cause.includes("ENOTFOUND")) {
    console.log("   → DNS: špatná URL nebo není internet. Zkontrolujte URL v Upstash Console.");
  }
  if (msg.includes("401") || msg.includes("Unauthorized")) {
    console.log("   → Token je neplatný. Zkopírujte znovu UPSTASH_REDIS_REST_TOKEN.");
  }
  if (msg.includes("NOPERM") || msg.includes("no permissions")) {
    console.log(
      "   → Token je read-only. V Upstash Console → REST API použijte hlavní token (Read-Write), ne Read-Only."
    );
  }
  ok = false;
}

console.log("\n--- Pay Guard integrace ---");
console.log(
  `NODE_ENV=${process.env.NODE_ENV ?? "(unset)"} → Upstash v aplikaci: ${
    process.env.NODE_ENV === "production" ? "ANO" : "NE (jen npm start / Vercel prod)"
  }`
);
console.log("npm run dev → vždy in-memory rate limit (Upstash se nepoužije)\n");

if (ok) {
  console.log("✅ Upstash je připravený pro production.");
  console.log("   Lokální prod test: npm run build && NODE_ENV=production npm start");
  process.exit(0);
}

console.log("❌ Opravte chyby výše.");
process.exit(1);
