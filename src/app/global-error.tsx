"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="cs">
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
            Pay Guard — chyba aplikace
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "0.875rem", marginBottom: "1rem" }}>
            Něco se pokazilo. Obnovte stránku nebo to zkuste později.
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
            Obnovit stránku
          </button>
        </div>
      </body>
    </html>
  );
}
