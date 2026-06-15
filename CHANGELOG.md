# Changelog

All notable changes to Pay Guard are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.1] — 2026-06-15

### Added

- [`.env.example`](./.env.example) — full env reference with `[PROD]` / `[DEV]` / `[STRIPE]` labels
- [`DEPLOY.md`](./DEPLOY.md) — step-by-step first Vercel deploy guide
- Vercel Production env table in README **Nasazení (Vercel)**
- Production Release Checklist item: all env vars in Vercel (via `.env.example`)

### Changed

- Migrated locale routing from deprecated `middleware.ts` to Next.js 16 **`src/proxy.ts`** (next-intl)
- `prod-checklist`: detect `PASTE_*` placeholder values in env validation
- `.gitignore`: allow committing `.env.example`, `.env.local.example`, `.env.test.example`

## [0.2.0] — 2026-06-11

### Added

- Playwright E2E suite with TypeScript preflight, poll-based assertions, and Pro gating coverage
- GitHub Actions workflows: **E2E Tests** (chromium smoke on PR/push) and **Prod Check** (build + prod checklist on `main`)
- Production Release Checklist in README (Czech + Russian)
- `CHANGELOG.md`
- Pro error boundaries (`ProErrorBoundary`, `pro/error.tsx`, pro-shell wrapper)
- Unified `useProAccess` as single subscription hook source
- Expanded Zod validation (`schemas.ts`) across API routes with `safeParse`
- `scripts/supabase-node-client.mjs` — explicit `ws` transport for Supabase on Node.js 20 (CI)

### Changed

- E2E stability: serial Pro gating, `gotoExpectOk`, duplicate preflight skip via `E2E_PREFLIGHT_DONE`
- Stripe webhook: release event lock on handler failure so Stripe retries transient errors
- History API: normalized 500 responses, strict query validation via Zod
- PDF export: request body size cap, client handling for 429 rate limits
- Auth send-otp: IP rate limit before JSON body parse
- History sync: typed `recommendation` in Zod schema (was `z.unknown()`)

### Security

- Webhook idempotency fail-closed in production without service role
- Pro API guards (`requireProApiWithRateLimit`) on PDF, sessions, and chat history routes
- Rate limits fail-closed in production without Upstash (`lib/security/rateLimit.ts`)
- RLS + `ensureProAccess()` on Pro financial CRUD; trigger `guard_profile_subscription_fields()`
- Service role key server-only; never `NEXT_PUBLIC_*`

### Fixed

- E2E CI: pass `UPSTASH_*` secrets to prod server startup (`instrumentation` assert)
- Prod Check CI: scope `NODE_ENV=production` to checklist step only (build no longer fails on GHA)
- `prod:checklist` / `db:verify`: Supabase client on Node.js 20 without native WebSocket (GHA runners)
- CI prod checklist: `ws` devDependency for Supabase realtime transport

[0.2.1]: https://github.com/iktprg-hash/pay-guard/releases/tag/v0.2.1
[0.2.0]: https://github.com/iktprg-hash/pay-guard/releases/tag/v0.2.0
