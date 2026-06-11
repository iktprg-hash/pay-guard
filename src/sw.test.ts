import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("service worker", () => {
  const swSource = readFileSync(
    join(process.cwd(), "src/sw.ts"),
    "utf8"
  );

  it("never caches authenticated API with CacheFirst or NetworkFirst", () => {
    expect(swSource).not.toMatch(/apiHistoryCache|apiChatCache|apiPrioritizeCache/);
    expect(swSource).not.toMatch(/CacheFirst\(/);
    expect(swSource).not.toMatch(/NetworkFirst\(/);
  });

  it("uses NetworkOnly for /api/*", () => {
    expect(swSource).toContain("NetworkOnly");
    expect(swSource).toContain('url.pathname.startsWith("/api/")');
  });
});
