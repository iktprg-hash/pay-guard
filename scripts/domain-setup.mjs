#!/usr/bin/env node
/**
 * Pay Guard — Vercel + custom domain setup helper.
 *
 * Usage:
 *   npm run domain:setup
 *   npm run domain:setup -- https://pay-guard.vercel.app
 *   npm run domain:setup -- payguard.cz
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getProjectRef, loadEnvLocal } from "./load-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

const ref = getProjectRef();
const arg = process.argv[2];
const envSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "")
  .replace(/^["']|["']$/g, "")
  .trim();

function normalizeSite(input) {
  if (!input) return null;
  const value = input.trim().replace(/\/$/, "");
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}

const site = normalizeSite(arg) ?? normalizeSite(envSite);

if (!site) {
  console.error(`
Pay Guard — domain setup

Укажите production URL (Vercel или свой домен):

  npm run domain:setup -- https://pay-guard-xxxx.vercel.app
  npm run domain:setup -- payguard.cz

Или добавьте в .env.local / Vercel env:
  NEXT_PUBLIC_SITE_URL=https://pay-guard-xxxx.vercel.app
`);
  process.exit(1);
}

const confirm = `${site}/auth/confirm`;
const callback = `${site}/auth/callback`;
const supabaseAuth = ref
  ? `https://supabase.com/dashboard/project/${ref}/auth/url-configuration`
  : "https://supabase.com/dashboard → Authentication → URL Configuration";
const vercelDomains = "https://vercel.com/dashboard → Project → Settings → Domains";

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Pay Guard — Domain & Vercel setup                           ║
╚══════════════════════════════════════════════════════════════╝

Production URL:  ${site}
Supabase ref:    ${ref ?? "?"}

─── 1) Vercel (сейчас: *.vercel.app) ───

A. Первый деплой (если ещё не сделан):
   • github.com/new → репозиторий pay-guard
   • vercel.com/new → Import → pay-guard
   • Framework: Next.js (auto)
   • Region: Frankfurt (fra1) — уже в vercel.json

B. Environment Variables (Vercel → Settings → Environment Variables):
   Production only — скопируйте из .env.local:

   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   XAI_API_KEY
   NEXT_PUBLIC_SITE_URL=${site}

   НЕ добавляйте: AUTH_DEV_REGISTER, AUTH_SKIP_RATE_LIMIT

C. После деплоя URL будет вида:
   https://pay-guard-xxxx.vercel.app
   Запустите снова:
   npm run domain:setup -- https://pay-guard-xxxx.vercel.app

─── 2) Supabase Auth URLs (обязательно) ───

${supabaseAuth}

Site URL:
  ${site}

Redirect URLs (вставьте построчно):
  ${confirm}
  ${callback}
  ${site}/**
  http://127.0.0.1:3000/auth/confirm
  http://localhost:3000/auth/confirm

─── 3) Свой домен позже (payguard.cz и т.д.) ───

${vercelDomains}
   • Add → payguard.cz (+ www при желании)
   • DNS у регистратора (Wedos, Cloudflare…):
       A     @    →  76.76.21.21   (Vercel)
       CNAME www  →  cname.vercel-dns.com

   • После проверки SSL обновите:
     NEXT_PUBLIC_SITE_URL=https://payguard.cz   (Vercel env)
     Supabase Site URL → https://payguard.cz
     + redirect ${confirm.replace(site, "https://payguard.cz")}

   • npm run domain:setup -- payguard.cz

─── 4) Проверка после настройки ───

   npm run prod:checklist
   Откройте ${site}/cs/login
   Register → email confirm → /auth/confirm → chat

─── 5) Локально (опционально) ───

   Добавьте в .env.local для preview prod URL:
   NEXT_PUBLIC_SITE_URL=${site}
`);
