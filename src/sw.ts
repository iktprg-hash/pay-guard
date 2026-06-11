/**
 * Pay Guard Service Worker (Serwist + Workbox strategies)
 *
 * Strategy overview (2026 PWA best practices):
 * - Precache: JS/CSS/fonts + critical shell routes (build manifest)
 * - /api/* → NetworkOnly (auth — never cache between users)
 * - PWA assets (manifest, icons, splash) → StaleWhileRevalidate
 * - App navigations → default Serwist document cache (offline fallback → /~offline)
 *
 * Recommendations & chat history use cache-first via IndexedDB on the client
 * (see lib/offline/cache-first.ts) — not SW API cache (security).
 */
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import { ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Authenticated API — always network, no cache (prevents cross-user data bleed) */
const apiNetworkOnly: typeof defaultCache[number] = {
  matcher({ url }) {
    return url.pathname.startsWith("/api/");
  },
  handler: new NetworkOnly(),
};

/** Manifests, icons, splash — cache-first for instant install / offline branding */
const staticPwaCache: typeof defaultCache[number] = {
  matcher({ url }) {
    return (
      url.pathname.includes("manifest.webmanifest") ||
      url.pathname === "/manifest.json" ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/splash/")
    );
  },
  handler: new CacheFirst({
    cacheName: "payguard-pwa-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 96,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
      }),
    ],
  }),
};

/** Next.js static chunks — stale-while-revalidate for fast repeat visits */
const nextStaticCache: typeof defaultCache[number] = {
  matcher({ url }) {
    return url.pathname.startsWith("/_next/static/");
  },
  handler: new StaleWhileRevalidate({
    cacheName: "payguard-next-static",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 256,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
};

/** Google fonts / external static (if any) */
const googleFontsCache: typeof defaultCache[number] = {
  matcher({ url }) {
    return url.origin === "https://fonts.googleapis.com";
  },
  handler: new StaleWhileRevalidate({
    cacheName: "payguard-google-fonts",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 16,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    apiNetworkOnly,
    staticPwaCache,
    nextStaticCache,
    googleFontsCache,
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
