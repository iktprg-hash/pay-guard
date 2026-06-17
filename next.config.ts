import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";
import path from "path";
import { fileURLToPath } from "url";
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const PWA_SHELL_ROUTES = ["", "/manual", "/settings", "/pricing"] as const;

const localePrecacheEntries = (["cs", "ru", "en"] as const).flatMap((locale) =>
  PWA_SHELL_ROUTES.map((path) => ({
    url: `/${locale}${path}`,
    revision: null,
  }))
);

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // Dev: no SW (fast refresh). Production (incl. Vercel): full PWA precache.
  disable: process.env.NODE_ENV === "development",
  register: false,
  reloadOnOnline: true,
  additionalPrecacheEntries: [
    { url: "/~offline", revision: null },
    ...localePrecacheEntries,
    { url: "/icons/icon-192x192.png", revision: null },
    { url: "/icons/icon-512x512.png", revision: null },
    { url: "/icons/icon-maskable-512x512.png", revision: null },
    { url: "/manifest.json", revision: null },
  ],
});

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development"
    ? { turbopack: { root: projectRoot } }
    : {}),
  ...(process.env.VERCEL ? {} : { outputFileTracingRoot: projectRoot }),
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSentryConfig(withSerwist(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source maps — загружать только на CI
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Без DSN / auth token — не загружать source maps (SDK остаётся optional)
  sourcemaps: {
    disable:
      !process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
});
