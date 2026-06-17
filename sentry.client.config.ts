import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Трекинг производительности — 10% трафика
  tracesSampleRate: 0.1,
  // Replay для ошибок — 100% при ошибке, 1% остальное
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true, // финансовые данные — маскируем всё
      blockAllMedia: true,
    }),
  ],
  // Не отправлять в dev
  enabled: process.env.NODE_ENV === "production",
});
