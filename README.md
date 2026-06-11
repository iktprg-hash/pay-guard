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
npm run build
npm run db:verify    # ověření schématu (vyžaduje DATABASE_URL nebo Supabase)
```

## Proměnné prostředí

| Proměnná | Popis |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase projektu |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only) |
| `XAI_API_KEY` | xAI Grok — bez klíče demo režim |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (prod) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (prod) |

`.env.local` nikdy necommitujte.

## Supabase — migrace

Spusťte v SQL Editoru **v pořadí**:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_session_token.sql`
3. `supabase/migrations/003_auth_profile.sql`
4. `supabase/migrations/004_session_sync.sql`
5. `supabase/migrations/005_normalize_debts.sql`
6. `supabase/migrations/006_protect_subscription_tier.sql`

Nebo s `DATABASE_URL`: `npm run db:apply:003` / `npm run db:hint`.

### Auth konfigurace

1. Zkopírujte URL, anon key a service role key do `.env.local`
2. Auth → URL Configuration: Site URL `http://127.0.0.1:3000`, Redirect URLs `/auth/confirm`
3. **Dev:** Confirm email OFF
4. **Prod:** Confirm email ON, Custom SMTP, redirect na produkční doménu

## Nasazení (Vercel)

1. Propojte repozitář s Vercel
2. Nastavte env proměnné (viz tabulka výše)
3. Ověřte migrace 001–006 v Supabase
4. `npm run prod:checklist` lokálně před prvním deployem
5. Po deployi: Auth redirect URLs + Site URL na produkční doménu

```bash
npm run verify:upstash      # ověření Redis + rate limiter
npm run prod:checklist      # checklist před deployem
```

### Production checklist

- Migrace **001–006** aplikované
- **Upstash** v env produkce
- **Custom SMTP** (Auth → Email)
- **Confirm email: ON** (prod)
- **`AUTH_DEV_REGISTER` unset** v produkci
- Redirect URLs: produkční doména + `/auth/confirm`
- Trigger `guard_profile_subscription_fields()` — uživatel nemůže sám eskalovat na Pro

## Struktura

```
src/
├── app/
│   ├── [locale]/          # Stránky (cs, ru, en)
│   │   ├── error.tsx      # Error boundary (locale)
│   │   └── (protected)/   # Auth-required routes + loading.tsx
│   ├── global-error.tsx   # Root error boundary
│   ├── api/               # chat, auth, sessions, prioritize
│   └── auth/confirm/      # E-mail / PKCE potvrzení
├── components/
│   ├── chat/              # Chat, consent gate, doporučení
│   ├── layout/            # Header, footer, skip link, app shell
│   ├── pwa/               # SW, offline, instalace
│   └── ui/                # toast, page loader, shadcn
├── lib/                   # auth, chat, grok, debts, security
├── sw.ts                  # Service worker (API bez cache)
└── messages/              # cs.json, ru.json, en.json
supabase/migrations/       # 001–006
```

## Auth flow (dev)

1. `/cs/register` → záložka **Heslo** → `Heslo123` (velké + malé + číslice)
2. Nebo **Kód z e-mailu** (vyžaduje SMTP v Supabase)
3. Po přihlášení se synchronizují konzultace z localStorage

## PWA a offline

- Service worker **nekachuje** `/api/*` — citlivá data zůstávají jen na síti
- Poslední doporučení a konverzace se ukládají lokálně (IndexedDB)
- Toast upozorní při přechodu online/offline
- Instalace: Chrome „Nainstalovat“ / Safari „Přidat na plochu“

## Bezpečnost a soukromí

- Lokální PII (chat, profil, dluhy) se ukládají šifrovaně (AES-GCM). Při odhlášení se smažou.
- Grok chat vyžaduje explicitní souhlas (`GrokConsentGate`).
- Rate limiting na auth a API v produkci (Upstash).
- Bez `XAI_API_KEY` funguje demo režim s mock odpověďmi.

## Přístupnost

- Skip link „Přeskočit na obsah“
- `aria-live` pro chat a toast notifikace
- Loading stavy se `role="status"`
- Error boundaries s tlačítkem obnovení
- Mobilní menu s `aria-expanded` a Escape pro zavření

## Licence

Soukromý projekt — kontaktujte autora pro použití mimo osobní účely.
