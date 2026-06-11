#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { databaseUrlHint, getProjectRef, loadEnvLocal } from "./load-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

const SITE = "http://127.0.0.1:3000";
const SITE_ALT = "http://localhost:3000";
const CONFIRM = `${SITE}/auth/confirm`;
const ref = getProjectRef();
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(missing in .env.local)";
const sqlUrl = ref
  ? `https://supabase.com/dashboard/project/${ref}/sql/new`
  : "https://supabase.com/dashboard → SQL Editor";

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Pay Guard — Supabase Auth setup                             ║
╚══════════════════════════════════════════════════════════════╝

Project: ${projectUrl}
Ref:     ${ref ?? "?"}

1) URL Configuration
   https://supabase.com/dashboard/project/${ref ?? "YOUR_REF"}/auth/url-configuration
   • Site URL:        ${SITE}
                      (или ${SITE_ALT} — главное: тот же host, что в браузере!)
   • Redirect URLs:   ${CONFIRM}
                      ${SITE_ALT}/auth/confirm
                      ${SITE}/auth/callback
                      ${SITE_ALT}/auth/callback
                      ${SITE}/**
                      ${SITE_ALT}/**

2) Providers (Authentication → Providers)
   • Email: ON
   • Confirm email: OFF (dev) / ON (prod)
   • Magic Link: ON (same Email provider)

   Rate Limits (Authentication → Rate Limits):
   • Po mnoha testech OTP: „email rate limit exceeded“
   • V dev zvyšte limity nebo použijte registraci heslem (Heslo123)
   • V dev naše API rate limit je vypnutý (NODE_ENV=development)

3) Migration 003 — выберите один способ:

   A) SQL Editor (без пароля БД):
      ${sqlUrl}
      → вставьте supabase/migrations/003_auth_profile.sql → Run

   B) Терминал:
      npm run db:hint   ← инструкция с вашим project ref
      → добавьте DATABASE_URL в .env.local
      → npm run db:apply:003

4) Test flow
   • ${SITE}/cs → /cs/login
   • Register → chat → logout → login → history restored
`);
