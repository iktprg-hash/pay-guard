import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PWA configuration", () => {
  const nextConfig = readFileSync(
    join(process.cwd(), "next.config.ts"),
    "utf8"
  );

  it("disables Serwist service worker in development and on Vercel", () => {
    expect(nextConfig).toContain('process.env.NODE_ENV === "development"');
    expect(nextConfig).toContain('process.env.VERCEL === "1"');
  });

  it("registers SW manually from client component", () => {
    expect(nextConfig).toContain("register: false");
  });
});
