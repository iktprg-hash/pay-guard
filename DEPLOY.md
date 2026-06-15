# Pay Guard — первый деплой на Vercel

Краткая инструкция перед production deploy. Полный чеклист — [README.md → Production deploy checklist](./README.md#production-deploy-checklist).

## 1. Подготовка репозитория

```bash
git clone git@github.com:iktprg-hash/pay-guard.git
cd pay-guard
npm ci
cp .env.example .env.local   # заполните локально для проверок
npm run prod:checklist
npm run build
```

## 2. Vercel — новый проект

1. [vercel.com/new](https://vercel.com/new) → Import → `pay-guard`
2. Framework: **Next.js** (auto)
3. Region: **Frankfurt (fra1)** — уже в `vercel.json`
4. Deploy (первый билд может упасть без env — это нормально)

## 3. Environment Variables (Production)

**Vercel → Project → Settings → Environment Variables → Production**

Скопируйте из `.env.local` (или `.env.example`). Обязательные:

| Переменная | Обязательно |
|------------|-------------|
| `NEXT_PUBLIC_SITE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ |
| `UPSTASH_REDIS_REST_URL` | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ |
| `XAI_API_KEY` | ✅ (без ключа — demo; для prod нужен) |
| `STRIPE_SECRET_KEY` | ✅ (Pro checkout) |
| `STRIPE_PRO_PRICE_ID` | ✅ |
| `STRIPE_WEBHOOK_SECRET` или `STRIPE_WEBHOOK_SECRET_LIVE` | ✅ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ |
| `XAI_MODEL` | опционально (`grok-3-mini`) |

**Никогда не добавляйте в Production:**

- `AUTH_DEV_REGISTER`
- `AUTH_SKIP_RATE_LIMIT`

После изменения env → **Redeploy** (не только Save).

## 4. Supabase

1. SQL Editor — миграции **001–010** + `20260615_pro_schema.sql` (см. README)
2. **Authentication → URL Configuration:**
   - Site URL: `https://<your-vercel-domain>`
   - Redirect URLs:
     - `https://<your-vercel-domain>/auth/confirm`
     - `https://<your-vercel-domain>/auth/callback`
     - `https://<your-vercel-domain>/**`
3. Production: **Confirm email ON**, Custom SMTP (рекомендуется)

```bash
npm run domain:setup -- https://your-app.vercel.app
```

## 5. Stripe

1. Product + recurring Price в **CZK** → `STRIPE_PRO_PRICE_ID`
2. Webhook endpoint: `https://<your-domain>/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
4. Signing secret → `STRIPE_WEBHOOK_SECRET_LIVE` (или `STRIPE_WEBHOOK_SECRET`)

## 6. Проверка после деплоя

```bash
npm run verify:upstash
npm run verify:stripe
npm run verify:webhook
npm run prod:checklist
curl -s https://<your-domain>/api/health
```

Ожидаемый health:

```json
{"ok":true,"supabase":true,"siteUrl":"https://<your-domain>"}
```

Smoke test в браузере:

1. `https://<your-domain>/cs/login`
2. Register → email confirm → `/auth/confirm` → chat
3. `/cs/pricing` → Pro checkout (если Stripe live)

## 7. CI

GitHub Actions: **E2E Tests** и **Prod Check** должны быть зелёными на `main`.

---

**Ссылки:** [.env.example](./.env.example) · [README — Nasazení (Vercel)](./README.md#nasazení-vercel)
