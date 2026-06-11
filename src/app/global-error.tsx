"use client";

import { useEffect, useMemo } from "react";
import {
  getGlobalErrorCopy,
  pickBrowserLocale,
} from "@/lib/pwa/static-messages";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = useMemo(() => {
    const locale = pickBrowserLocale();
    return { locale, ...getGlobalErrorCopy(locale) };
  }, []);

  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  useEffect(() => {
    document.documentElement.lang = copy.locale;
  }, [copy.locale]);

  return (
    <html lang={copy.locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0f",
          color: "#fafafa",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Pay Guard — {copy.title}
          </h1>
          <p
            style={{
              color: "#a1a1aa",
              fontSize: "0.875rem",
              marginBottom: "1rem",
            }}
          >
            {copy.description}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1rem",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
