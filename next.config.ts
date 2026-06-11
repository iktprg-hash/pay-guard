import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";
import path from "path";
import { fileURLToPath } from "url";
import { SECURITY_HEADERS } from "./src/lib/security/headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // Dev: no SW (fast refresh). Production (incl. Vercel): full PWA precache.
  disable: process.env.NODE_ENV === "development",
  register: false,
  reloadOnOnline: true,
  additionalPrecacheEntries: [
    { url: "/~offline", revision: null },
    { url: "/cs", revision: null },
    { url: "/ru", revision: null },
    { url: "/en", revision: null },
    { url: "/icons/icon-192x192.png", revision: null },
    { url: "/icons/icon-512x512.png", revision: null },
    { url: "/icons/icon-maskable-512x512.png", revision: null },
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
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
