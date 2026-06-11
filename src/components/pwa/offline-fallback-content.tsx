"use client";

import { useEffect, useMemo } from "react";
import {
  getOfflineFallbackCopy,
  pickBrowserLocale,
} from "@/lib/pwa/static-messages";

/** Offline fallback s i18n podle jazyka prohlížeče */
export function OfflineFallbackContent() {
  const copy = useMemo(() => {
    const locale = pickBrowserLocale();
    return { locale, ...getOfflineFallbackCopy(locale) };
  }, []);

  useEffect(() => {
    document.documentElement.lang = copy.locale;
  }, [copy.locale]);

  return (
    <div>
      <p style={{ fontSize: "3rem", margin: 0 }} aria-hidden>
        📡
      </p>
      <h1 style={{ fontSize: "1.25rem" }}>{copy.title}</h1>
      <p style={{ color: "#a1a1aa", maxWidth: "20rem" }}>{copy.fallbackBody}</p>
      <p>
        <a href={`/${copy.locale}`}>{copy.backToApp}</a>
      </p>
    </div>
  );
}
