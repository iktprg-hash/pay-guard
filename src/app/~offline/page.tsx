import { OfflineFallbackContent } from "@/components/pwa/offline-fallback-content";

/** Fallback dokument pro Serwist když navigace selže offline */
export default function OfflineFallbackPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#6366f1" />
        <title>Pay Guard — Offline</title>
        <style>{`
          body {
            margin: 0;
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: system-ui, sans-serif;
            background: #0a0a0f;
            color: #fafafa;
            padding: 1.5rem;
            text-align: center;
          }
          a { color: #818cf8; }
        `}</style>
      </head>
      <body>
        <OfflineFallbackContent />
      </body>
    </html>
  );
}
