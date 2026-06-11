# Pay Guard

Chytrý pomocník pro prioritizaci plateb pro občany České republiky.

## Funkce

- **Chat s Grok** (xAI) — přirozený dialog v češtině (i ruštině a angličtině)
- **Hlasový vstup** — Web Speech API s fallbackem
- **Deterministický algoritmus** — priority plateb v kódu, ne v AI
- **Ruční zadání** — záložní režim bez chatu
- **Supabase Auth** — heslo, OTP kód, sync konzultací
- **PWA** — instalace, offline fallback (bez cache autentizovaných API)

## Stack

- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind CSS 4 + shadcn/ui
- Supabase (Auth, DB, RLS)
- xAI Grok API
- Serwist PWA
- next-intl (cs / ru / en)
- Upstash Redis (rate limits v produkci, volitelné)

## Rychlý start

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
```

## Supabase

1. Vytvořte projekt na [supabase.com](https://supabase.com)
2. Spusťte migrace v SQL Editoru **v pořadí**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_session_token.sql`
   - `supabase/migrations/003_auth_profile.sql`
   - `supabase/migrations/004_session_sync.sql`
3. Zkopírujte URL, anon key a service role key do `.env.local`
4. Auth → URL Configuration: Site URL `http://127.0.0.1:3000`, Redirect URLs `/auth/confirm`
5. Auth → Providers: Email ON, **Confirm email OFF** (dev)

Nebo: `npm run db:apply:003` / `npm run db:hint` s `DATABASE_URL`.

## Rate limits (produkce)

V dev jsou auth rate limity vypnuté. V produkci nastavte Upstash:

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

Bez Upstash se použije in-memory limiter (nedostatečné pro Vercel multi-instance).

```bash
npm run verify:upstash      # ověření Redis + rate limiter
npm run prod:checklist      # checklist před deployem (env, migrace, security)
```

### Production checklist (ručně v Supabase)

- Migrace **001–004** aplikované (SQL Editor nebo `DATABASE_URL` + `npm run prod:checklist`)
- **Upstash** v env produkce + `npm run verify:upstash`
- **Custom SMTP** (Auth → Email) — OTP a reset hesla
- **Confirm email: ON** (prod), OFF pouze v dev
- **`AUTH_DEV_REGISTER` unset** v produkci
- Redirect URLs: produkční doména + `/auth/confirm`

## Struktura

```
src/
├── app/
│   ├── [locale]/          # Stránky (cs, ru, en)
│   ├── api/
│   │   ├── auth/          # login, register, OTP, logout
│   │   ├── chat/          # Grok + historie
│   │   ├── sessions/      # Seznam konzultací
│   │   └── session/claim/ # Propojení anonymní relace
│   └── auth/confirm/      # E-mail / PKCE potvrzení
├── proxy.ts               # Auth gate + i18n
├── components/            # UI, auth, chat, PWA
├── lib/
│   ├── auth/              # Session, redirect, rate limit
│   ├── chat/              # Persistence, sync, localStorage
│   ├── grok/              # xAI klient
│   ├── security/          # Tokeny, rate limit
│   └── supabase/          # Klienti (browser, server, service)
├── sw.ts                  # Service worker (API bez cache)
└── messages/              # cs, ru, en
supabase/migrations/       # 001–004
```

## Auth flow (dev)

1. `/cs/register` → záložka **Heslo** → `Heslo123` (velké + malé + číslice)
2. Nebo **Kód z e-mailu** (vyžaduje SMTP v Supabase)
3. Po přihlášení se synchronizují konzultace z localStorage

## Poznámky

- Bez `XAI_API_KEY` funguje demo režim s mock odpověďmi.
- Service worker **nekachuje** `/api/*` — citlivá data zůstávají jen na síti.
- **Lokální PII** (chat, profil, dluhy) se ukládají šifrovaně (AES-GCM). Při odhlášení se smažou. Šifrování nechrání před XSS — stejně jako u jakékoli webové aplikace.
- `.env.local` nikdy necommitujte.
