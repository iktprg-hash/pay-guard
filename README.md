# Pay Guard

Chytrý pomocník pro prioritizaci plateb pro občany České republiky.

**Produkce:** [pay-guard-murex-alpha.vercel.app](https://pay-guard-murex-alpha.vercel.app)

Pay Guard pomáhá rozhodnout, **kam poslat omezené peníze**, když je závazků hodně. Aplikace vede přirozený dialog (česky, rusky, anglicky), shromažďuje údaje o dlužích a příjmu a vrátí **deterministické doporučení priorit** — algoritmus běží v kódu, ne v AI.

## Co aplikace umí

- **Chat s Grok** (xAI) — konverzační sběr dat s explicitním souhlasem uživatele
- **Hlasový vstup** — Web Speech API s fallbackem
- **Priority Engine** — pravidla plateb v TypeScriptu, ne v LLM
- **Ruční zadání** — záložní režim bez chatu
- **Konzultace** — historie rozhovorů (Pro), sync po přihlášení
- **PWA** — instalace na plochu, offline prohlížení posledních dat
- **Tři jazyky** — cs (výchozí), ru, en (next-intl)
- **Přístupnost** — skip link, ARIA stavy, klávesnicová navigace, error boundaries

## Stack

- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind CSS 4 + shadcn/ui
- Supabase (Auth, DB, RLS)
- xAI Grok API
- Serwist PWA
- Upstash Redis (rate limits v produkci, volitelné)

## Rychlý start (vývoj)

```bash
cd ~/Projects/pay-guard
cp .env.local.example .env.local
# Vyplňte XAI_API_KEY a Supabase credentials

npm install
npm run dev
```

Otevřete [http://127.0.0.1:3000/cs](http://127.0.0.1:3000/cs) — používejte **127.0.0.1**, ne `localhost` (Supabase cookies).

```bash
npm run auth:setup   # checklist Supabase Auth
npm test
npm run test:e2e:install   # Playwright browsers + deps (jednorázově)
npm run build
npm run db:verify    # ověření schématu (vyžaduje DATABASE_URL nebo Supabase)
```

## E2E (Playwright)

End-to-end testy pokrývají auth, checkout (Stripe mock), Pro gating a PDF export. Specs jsou v `tests/`, konfigurace v `playwright.config.ts`.

### Příprava

```bash
cp .env.local.example .env.local
# Vyplňte Supabase (povinné pro auth + E2E):
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...   # pro AUTH_DEV_REGISTER=1

cp .env.test.example .env.local   # nebo přidejte E2E proměnné ručně
# Povinné pro automatickou registraci testovacího účtu:
# AUTH_DEV_REGISTER=1
# E2E_FREE_USER_EMAIL=e2e-free@pay-guard.test
# E2E_FREE_USER_PASSWORD=E2eTestPass1

npm run test:e2e:install
```

| Proměnná | Popis |
|----------|--------|
| `E2E_BASE_URL` | URL aplikace (default `http://127.0.0.1:3000` — musí sedět s `npm run dev`) |
| `E2E_LOCALE` | Locale prefix pro testy (default `cs`) |
| `E2E_FREE_USER_EMAIL` / `E2E_FREE_USER_PASSWORD` | Free-tier test účet |
| `AUTH_DEV_REGISTER` | `1` — dev bypass registrace (Supabase service role) |
| `E2E_NO_WEBSERVER` | `1` — nespouštět `npm run dev` z Playwright (doporučeno lokálně) |
| `E2E_GREP` / `E2E_GREP_INVERT` | Filtr testů v CI |

Auth storage se ukládá do `playwright/.auth/user.json` (gitignored) přes `tests/auth.setup.ts`.

**Konfigurace:** timeout 90 s, `reuseExistingServer: true`, reporter `list` + HTML lokálně / `dot` + HTML v CI. Všechny URL respektují locale prefix (`E2E_LOCALE`, default `/cs`).

### Spuštění

**Doporučený lokální workflow** (vyhne se EMFILE / file watcher limitům):

```bash
# Terminál 1 — vždy po větších změnách nebo HTTP 500:
npm run dev:restart

# Terminál 2
npm run test:e2e:local                  # všechny E2E
npm run test:e2e:local -- --project=chromium   # smoke + auth-chat
npm run test:e2e:local -- tests/checkout-flow.spec.ts
npm run test:e2e:ui                     # interaktivní UI mode
npm run test:e2e:report                 # HTML report po běhu
npm run test:e2e:debug                  # step-through debugger
```

Plný běh včetně auto-startu dev serveru:

```bash
npm run test:e2e
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Mass E2E failures (login, smoke, health) | Corrupted `.next/dev/prerender-manifest.json` → **HTTP 500**. Fix: `npm run dev:restart` |
| `E2E preflight: /api/health returned HTTP 500` | Same — run `npm run dev:restart` (clears `.next` and restarts) |
| `EMFILE: too many open files` | Run `npm run dev` in a separate terminal, then `npm run test:e2e:local` |
| Checkout / pricing guest tests **skipped** | Add `STRIPE_SECRET_KEY` + `STRIPE_PRO_PRICE_ID` to `.env.local` |

Preflight check (`tests/global-setup.ts`) verifies `/api/health` before tests when using `E2E_NO_WEBSERVER=1`.

### Co testy pokrývají

| Soubor | Scénáře |
|--------|---------|
| `tests/smoke.spec.ts` | Login/register, security headers, PWA manifest |
| `tests/auth-chat.spec.ts` | Auth redirect, API 401 bez session |
| `tests/checkout-flow.spec.ts` | Guest → pricing → login; Free → mock Stripe checkout → Pro UI |
| `tests/pro-gating.spec.ts` | Free gate/blur, PDF blocked, Pro full access, tier poll |

Stripe se v checkout testech mockuje přes `page.route` (`tests/helpers/billing-mocks.ts` — checkout, confirm, sync). Pro stabilní UI se používá `expect.poll()` (`pollForProUnlocked`, `pollForNoUpgradeGate`). Checkout test se **skipne**, pokud není nakonfigurován `STRIPE_SECRET_KEY` + `STRIPE_PRO_PRICE_ID`.

### Projects (playwright.config.ts)

- `setup` — `auth.setup.ts` (ensureTestUser + storageState)
- `chromium` — smoke, auth-chat (bez auth)
- `chromium-authenticated` — checkout-flow, pro-gating
- `mobile` — pro-gating (Pixel 7)

## Proměnné prostředí

| Proměnná | Popis |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase projektu |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only) |
| `XAI_API_KEY` | xAI Grok — bez klíče demo režim |
| `XAI_MODEL` | Grok model (volitelné, default `grok-3-mini`) |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (prod, povinné) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (prod, povinné) |
| `STRIPE_SECRET_KEY` | Stripe secret (test/live) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (fallback) |
| `STRIPE_WEBHOOK_SECRET_TEST` | Test-mode webhook secret |
| `STRIPE_WEBHOOK_SECRET_LIVE` | Live-mode webhook secret |
| `STRIPE_PRO_PRICE_ID` | Recurring CZK price id (`price_…`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_SITE_URL` | Veřejná URL (checkout redirect, metadata) |

`.env.local` nikdy necommitujte.

## Supabase — migrace

Spusťte v SQL Editoru **v pořadí**:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_session_token.sql`
3. `supabase/migrations/003_auth_profile.sql`
4. `supabase/migrations/004_session_sync.sql`
5. `supabase/migrations/005_normalize_debts.sql`
6. `supabase/migrations/006_protect_subscription_tier.sql`
7. `supabase/migrations/007_grok_consent.sql`
8. `supabase/migrations/008_stripe_billing.sql`
9. `supabase/migrations/009_stripe_webhook_events.sql`
10. `supabase/migrations/20260615_pro_schema.sql` — Pro financial tables (debts, incomes, expenses)

Nebo s `DATABASE_URL`: `npm run db:apply:003` / `npm run db:hint`.

### RLS a Pro gating

- Všechny Pro finanční tabulky mají RLS — uživatel vidí jen vlastní řádky.
- Trigger `guard_profile_subscription_fields()` brání eskalaci `subscription_tier` z klienta.
- Pro CRUD běží přes Supabase client (`pro-financial.ts`) s `ensureProAccess()` — ne přes REST `/api/pro/*`.
- Pro-gated REST API: `/api/pdf/*`, `/api/sessions*`, `/api/chat/history` — vyžadují `requireProApiUser()` + rate limit.

### Auth konfigurace

1. Zkopírujte URL, anon key a service role key do `.env.local`
2. Auth → URL Configuration: Site URL `http://127.0.0.1:3000`, Redirect URLs `/auth/confirm`
3. **Dev:** Confirm email OFF
4. **Prod:** Confirm email ON, Custom SMTP, redirect na produkční doménu

## Nasazení (Vercel)

1. Propojte repozitář s Vercel
2. Nastavte env proměnné (viz tabulka výše)
3. Ověřte migrace **001–010** v Supabase
4. `npm run prod:checklist` lokálně před prvním deployem
5. Po deployi: Auth redirect URLs + Site URL na produkční doménu
6. Stripe webhook endpoint: `https://<domain>/api/billing/webhook` (nebo `/api/webhooks/stripe` dle konfigurace)
7. `npm run verify:upstash` v produkčním env

```bash
npm run verify:upstash      # ověření Redis + rate limiter
npm run prod:checklist      # checklist před deployem
npm run build               # finální build před releasem
```

### Production deploy checklist

**Infrastruktura**

- [ ] Migrace **001–010** aplikované v Supabase SQL Editoru
- [ ] **Upstash Redis** (`UPSTASH_REDIS_REST_URL` + `TOKEN`) v produkčním env
- [ ] **Custom SMTP** (Supabase Auth → Email)
- [ ] **Confirm email: ON** (prod)
- [ ] **`AUTH_DEV_REGISTER` unset** v produkci
- [ ] Redirect URLs: produkční doména + `/auth/confirm`
- [ ] `NEXT_PUBLIC_SITE_URL` = produkční URL

**Stripe**

- [ ] Live `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_PRO_PRICE_ID` (CZK recurring)
- [ ] Webhook secrets: `STRIPE_WEBHOOK_SECRET_LIVE` (+ test pro preview deploye)
- [ ] Webhook events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- [ ] Customer portal enabled (billing portal route)

**Bezpečnost**

- [ ] Trigger `guard_profile_subscription_fields()` aktivní
- [ ] RLS zapnuté na všech tabulkách s PII
- [ ] Rate limits aktivní (Upstash) — auth, chat, **Pro API** (30/min sessions/history, **10/min PDF**)
- [ ] `ProFeatureGate` + `ensureProAccess()` — Free uživatelé nemohou mutovat Pro data
- [ ] Service role key pouze na serveru (Vercel env, ne `NEXT_PUBLIC_*`)
- [ ] Webhook raw body + idempotence (`009_stripe_webhook_events.sql`)

**PWA**

- [ ] `/[locale]/manifest.webmanifest` vrací lokalizovaný manifest
- [ ] Ikony v `/public/icons/` + splash v `/public/splash/`
- [ ] Service worker registrován (Serwist) — `/api/*` NetworkOnly, fonty/icons cache-first

### Production security notes

- **Rate limits** (`lib/security/rateLimit.ts`, `pro-rate-limit.ts`): klíče `pro:<action>:<userId>:<ip>`. Bez Upstash v produkci se limiter fail-closed.
- **Pro gating**: UI blur přes `ProFeatureGate`; server-side `requireProApiUser()` na PDF/sessions/history; Supabase RLS + `ensureProAccess()` na finanční CRUD.
- **Webhook secrets**: nikdy do klienta; test/live odděleně; handler vrací 200 i při interních chybách (Stripe retry), loguje structured errors.
- **Offline data**: IndexedDB + AES-GCM (`ensureLocalStorageCrypto`); `/api/*` se nekachuje ve SW.

### Testování před releasem

**Pro flow**

1. Free účet → `/cs/pro/dashboard` — skeleton, upgrade banner, blurred preview
2. Checkout → Stripe test card `4242…` → webhook → tier `pro` v profilu
3. Pro dashboard — debts/incomes/expenses CRUD, forecast, PDF export
4. Chat → Load/Save to Pro, sync badge (Synced / Offline / Failed)
5. Consultations — seznam, otevření session, PDF u doporučení

**Offline režim**

1. Vygenerujte doporučení online (chat nebo manual)
2. DevTools → Network → Offline
3. Ověřte `OfflineBanner`, `OfflineRecommendationCard`, cache-first doporučení
4. Pro sync tlačítka disabled + badge „Offline“
5. `persistRecommendationOffline` — data v IndexedDB, šifrovaná po prvním consent

**Rate limits (volitelně)**

- Opakované volání `/api/pdf/recommendation` → 429 po 10 req/min
- Opakované GET `/api/sessions` → 429 po 30 req/min

### Původní checklist (zkrácený)

- **Zálohy DB** — lokálně na disk (`npm run db:backup`), viz níže
## Zálohy databáze (pouze lokální disk)

Zálohy **zůstávají jen na vašem počítači**. Skript nic nenahrává do GitHubu, Supabase Storage ani jiného cloudu.

### Spuštění

```bash
npm run db:backup
```

Výchozí složka: **`~/PayGuard-backups/pay-guard-<timestamp>/`**

Obsah: JSON tabulky + `pay-guard-*.json.gz` archiv + `manifest.json`.

### Vlastní cesta

V `.env.local`:

```env
BACKUP_DIR=/Users/vas/Dis/PayGuard-backups
BACKUP_RETAIN_DAYS=30
```

### Připojení k DB

Stačí `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (už v `.env.local`).

Volitelně rychlejší export: `DATABASE_URL` z Supabase → Database → Connection string (port 6543).

### Automatizace na Macu (cron)

Každou neděli v 3:00:

```bash
crontab -e
```

```
0 3 * * 0 cd /Users/vas/Projects/pay-guard && /usr/local/bin/npm run db:backup >> ~/PayGuard-backups/backup.log 2>&1
```

(Upravte cestu k projektu a `npm`.)

### Bezpečnost

- Složka **`~/PayGuard-backups`** není v git repozitáři
- Obsahuje **PII** — zálohujte na externí disk / Time Machine podle potřeby
- Nikdy necommitujte a nesdílejte archivy

### Obnovení (dry-run)

Skript **nic neimportuje** do Supabase — jen ověří integritu zálohy a vypíše počty řádků:

```bash
npm run db:restore -- ~/PayGuard-backups/pay-guard-<timestamp>
# nebo přímo .json.gz archiv
npm run db:restore -- ~/PayGuard-backups/pay-guard-<timestamp>/pay-guard-<timestamp>.json.gz
```

**Důležité:** záloha neobsahuje `auth.users` (Supabase Auth). Uživatelské účty obnovujte přes Supabase dashboard nebo registraci.

## Struktura

```
src/
├── app/
│   ├── [locale]/          # Stránky (cs, ru, en)
│   │   ├── (pro)/         # Pro shell + loading.tsx skeletons
│   │   ├── (protected)/   # Auth-required routes + consultations
│   │   └── error.tsx      # Error boundary (locale)
│   ├── global-error.tsx   # Root error boundary
│   ├── api/               # chat, auth, sessions, pdf, billing
│   └── auth/confirm/      # E-mail / PKCE potvrzení
├── components/
│   ├── pro/               # ProFeatureGate, skeletons, views
│   ├── chat/              # Chat, ProSyncBar, doporučení
│   ├── layout/            # Header, footer, skip link, app shell
│   ├── pwa/               # SW, offline, instalace
│   └── ui/                # toast, page loader, shadcn
├── lib/                   # auth, billing, security, offline
├── sw.ts                  # Service worker (API NetworkOnly)
└── messages/              # cs.json, ru.json, en.json
supabase/migrations/       # 001–010 + pro schema
```

## Auth flow (dev)

1. `/cs/register` → záložka **Heslo** → `Heslo123` (velké + malé + číslice)
2. Nebo **Kód z e-mailu** (vyžaduje SMTP v Supabase)
3. Po přihlášení se synchronizují konzultace z localStorage

## PWA a offline

- Service worker **nekachuje** `/api/*` — citlivá data zůstávají jen na síti
- **Kachuje**: ikony, splash, `/fonts/*` (PDF), Next static chunks
- Poslední doporučení a konverzace se ukládají lokálně (IndexedDB, AES-GCM)
- Toast upozorní při přechodu online/offline
- Dynamický manifest: `/[locale]/manifest.webmanifest` (shortcuts: Chat, Manual, Consultations, Pro)

### Instalace PWA

**Chrome / Edge (desktop & Android)**

1. Otevřete `https://<domain>/cs`
2. Adresní řádek → ikona „Instalovat“ / menu → „Nainstalovat Pay Guard“
3. Po instalaci: standalone okno, offline fallback na `/~offline`

**Safari (iOS)**

1. Otevřete web v Safari
2. Sdílet → „Přidat na plochu“
3. Apple touch icon + splash screens z `<head>` v layoutu

**Ověření**

- DevTools → Application → Service Workers — aktivní SW
- Application → Manifest — ikony, shortcuts, screenshots
- Network offline → `OfflineBanner` + cached recommendation

## Bezpečnost a soukromí

- Lokální PII (chat, profil, dluhy) se ukládají šifrovaně (AES-GCM). Při odhlášení se smažou.
- Grok chat vyžaduje explicitní souhlas (`GrokConsentGate`).
- Rate limiting na auth, chat a **Pro API** v produkci (Upstash) — viz `PRO_RATE_LIMITS` v `pro-rate-limit.ts`.
- PDF export: 10 req/min; sessions/history: 30 req/min (per user + IP).
- Bez `XAI_API_KEY` funguje demo režim s mock odpověďmi.

## Přístupnost

- Skip link „Přeskočit na obsah“
- `lang` + `dir="ltr"` na `<html>` (next-intl locale)
- Per-page `<title>` / meta na Pro stránkách a konzultacích (`generateMetadata`)
- `aria-live`, `aria-busy`, `role="status"` na skeletons, PDF tlačítkách, Pro sync baru
- Loading stavy se `role="status"` (`ProGateSkeleton`, `ConsultationsSkeleton`)
- Error boundaries s tlačítkem obnovení
- Mobilní menu s `aria-expanded` a Escape pro zavření
- Pro upgrade banner — focus ring, `aria-label` na CTA

## Licence

Soukromý projekt — kontaktujte autora pro použití mimo osobní účely.
