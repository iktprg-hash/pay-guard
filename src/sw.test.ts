import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("service worker", () => {
  const swSource = readFileSync(
    join(process.cwd(), "src/sw.ts"),
    "utf8"
  );

  it("uses CacheFirst for PWA static assets only", () => {
    expect(swSource).toContain("CacheFirst");
    expect(swSource).toContain("payguard-pwa-assets");
  });

  it("uses NetworkOnly for /api/*", () => {
    expect(swSource).toContain("NetworkOnly");
    expect(swSource).toContain('url.pathname.startsWith("/api/")');
  });
});
