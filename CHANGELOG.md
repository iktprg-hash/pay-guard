# Changelog

All notable changes to Pay Guard are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-06-11

### Added

- Playwright E2E suite with TypeScript preflight, poll-based assertions, and Pro gating coverage
- GitHub Actions workflows: **E2E Tests** (chromium smoke on PR/push) and **Prod Check** (build + prod checklist on `main`)
- Production Release Checklist in README
- `CHANGELOG.md`

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

[0.2.0]: https://github.com/iktprg-hash/pay-guard/releases/tag/v0.2.0
