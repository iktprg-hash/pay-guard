import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
  // Игнорировать ожидаемые ошибки (Pro gate, rate limit — не баги)
  ignoreErrors: [
    /Pro subscription required/,
    /Rate limit exceeded/,
    /Authentication required/,
  ],
});
