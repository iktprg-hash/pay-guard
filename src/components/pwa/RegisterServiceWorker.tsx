"use client";

import { useEffect } from "react";

/**
 * Registruje Service Worker v produkci.
 * Serwist generuje /sw.js při `next build`; registrace je oddělená kvůli SSR kompatibilitě.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[PWA] SW registration failed:", err));
  }, []);

  return null;
}
