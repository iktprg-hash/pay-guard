/**
 * Pay Guard Service Worker (Serwist + Workbox strategies)
 *
 * - Precache: statické assety (generováno při buildu)
 * - /api/* se NIKDY neukládá do cache (autentizované odpovědi)
 * - Offline fallback dokument: /~offline
 */
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";
import { ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Autentizované API — vždy síť, bez cache (prevence úniku dat mezi uživateli) */
const apiNetworkOnly: typeof defaultCache[number] = {
  matcher({ url }) {
    return url.pathname.startsWith("/api/");
  },
  handler: new NetworkOnly(),
};

/** Manifesty a ikony — stale-while-revalidate */
const staticPwaCache: typeof defaultCache[number] = {
  matcher({ url }) {
    return (
      url.pathname.includes("manifest.webmanifest") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/splash/")
    );
  },
  handler: new StaleWhileRevalidate({
    cacheName: "payguard-pwa-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 64,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiNetworkOnly, staticPwaCache, ...defaultCache],
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
