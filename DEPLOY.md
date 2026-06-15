# Pay Guard — первый деплой на Vercel

Пошаговая инструкция перед production deploy.

**Ссылки:** [`.env.example`](./.env.example) · [README → Nasazení (Vercel)](./README.md#nasazení-vercel) · [Production deploy checklist](./README.md#production-deploy-checklist)

---

## Шаг 0. Предварительные требования

- Репозиторий на GitHub: `iktprg-hash/pay-guard`
- Supabase project с применёнными миграциями **001–010** + `20260615_pro_schema.sql`
- Upstash Redis database
- xAI API key (Grok)
- Stripe account с CZK recurring Price (Pro)
- Аккаунт Vercel

---

## Шаг 1. Локальная проверка

```bash
git clone git@github.com:iktprg-hash/pay-guard.git
cd pay-guard
npm ci
cp .env.example .env.local
# Vyplňte .env.local skutečnými klíči (nikdy necommitujte)

npm run prod:checklist
npm run build
npm run verify:upstash
npm run verify:stripe
npm run verify:webhook
```

Ожидаемо: **0 blockers** в checklist (2 dev-warnings для `AUTH_DEV_REGISTER` и `NODE_ENV` — норма).

---

## Шаг 2. Vercel — import проекта

1. Откройте [vercel.com/new](https://vercel.com/new)
2. **Import** → выберите `pay-guard`
3. Framework: **Next.js** (auto-detect)
4. Root Directory: `./`
5. Region: **Frankfurt (fra1)** — уже в `vercel.json`
6. Первый deploy можно запустить сразу (без env билд может упасть — это OK)

---

## Шаг 3. Environment Variables (Production)

**Vercel → Project → Settings → Environment Variables → Environment: Production**

Скопируйте из `.env.local`. Полный список — в [`.env.example`](./.env.example).

| Переменная | Обязательно | Пример / источник |
|------------|-------------|-------------------|
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://pay-guard-xxxx.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → API (server only!) |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Console |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Console |
| `XAI_API_KEY` | ✅ | console.x.ai |
| `XAI_MODEL` | — | `grok-3-mini` (default) |
| `STRIPE_SECRET_KEY` | ✅ | Stripe → API keys (`sk_live_…`) |
| `STRIPE_PRO_PRICE_ID` | ✅ | Stripe → Product → Price (`price_…`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe → API keys (`pk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` или `STRIPE_WEBHOOK_SECRET_LIVE` | ✅ | Stripe → Webhooks → Signing secret |

**Никогда не добавляйте в Production:**

| Переменная | Причина |
|------------|---------|
| `AUTH_DEV_REGISTER` | Dev bypass registrace |
| `AUTH_SKIP_RATE_LIMIT` | Vypnutí rate limitu |

После любого изменения env → **Deployments → Redeploy** (не только Save).

---

## Шаг 4. Supabase Auth URLs

```bash
npm run domain:setup -- https://your-app.vercel.app
```

В [Supabase Dashboard → Authentication → URL Configuration](https://supabase.com/dashboard):

- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:**
  - `https://your-app.vercel.app/auth/confirm`
  - `https://your-app.vercel.app/auth/callback`
  - `https://your-app.vercel.app/**`
  - `http://127.0.0.1:3000/auth/confirm` (dev)

Production:

- **Confirm email: ON**
- **Custom SMTP** (рекомендуется для OTP / reset password)

---

## Шаг 5. Stripe webhook

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://your-app.vercel.app/api/webhooks/stripe`
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Signing secret → `STRIPE_WEBHOOK_SECRET_LIVE` (или `STRIPE_WEBHOOK_SECRET`) на Vercel
5. **Redeploy** после добавления secret

---

## Шаг 6. Проверка после deploy

```bash
curl -s https://your-app.vercel.app/api/health
npm run verify:upstash
npm run verify:stripe
npm run verify:webhook
npm run prod:checklist
```

**Health (ожидаемый ответ):**

```json
{"ok":true,"supabase":true,"siteUrl":"https://your-app.vercel.app"}
```

**Webhook probe (без подписи):** HTTP **400** — маршрут жив, secret настроен.

---

## Шаг 7. Smoke test в браузере

1. `https://your-app.vercel.app/cs/login`
2. Register → email confirm → `/auth/confirm` → chat
3. `/cs/pricing` → Pro checkout (Stripe live)
4. `/cs/pro/dashboard` — Pro gating для free user

---

## Шаг 8. CI / Release

- GitHub Actions: **E2E Tests** + **Prod Check** — зелёные на `main`
- Тег релиза: `git tag v0.2.x && git push origin v0.2.x`
- Чеклист: [README → Production Release Checklist](./README.md#production-release-checklist)

---

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| `prod:checklist` — PASTE_ / placeholder keys | Замените stub-значения в `.env.local`; не дублируйте ключи (первое значение wins) |
| Build warning `middleware deprecated` | Используйте `src/proxy.ts` (Next.js 16), не `middleware.ts` |
| Rate limits не работают | Upstash env на Vercel + `NODE_ENV=production` (Vercel ставит автоматически) |
| Stripe webhook 400/500 | Проверьте signing secret и Recent deliveries в Stripe Dashboard |
| Auth redirect loop | Supabase Site URL + Redirect URLs = production domain |

---

## Свой домен (пozději)

1. Vercel → Settings → Domains → Add `payguard.cz`
2. DNS: `A @ → 76.76.21.21`, `CNAME www → cname.vercel-dns.com`
3. Обновите `NEXT_PUBLIC_SITE_URL`, Supabase URLs, Stripe webhook URL
4. `npm run domain:setup -- payguard.cz`
