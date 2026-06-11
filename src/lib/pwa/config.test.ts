import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PWA configuration", () => {
  const nextConfig = readFileSync(
    join(process.cwd(), "next.config.ts"),
    "utf8"
  );

  it("disables Serwist service worker in development", () => {
    expect(nextConfig).toContain(
      "disable: process.env.NODE_ENV === \"development\""
    );
  });

  it("registers SW manually from client component", () => {
    expect(nextConfig).toContain("register: false");
  });
});
