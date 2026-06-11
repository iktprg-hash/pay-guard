import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PWA configuration", () => {
  const nextConfig = readFileSync(
    join(process.cwd(), "next.config.ts"),
    "utf8"
  );

  it("disables Serwist only in development (enabled on Vercel production builds)", () => {
    expect(nextConfig).toContain('process.env.NODE_ENV === "development"');
    expect(nextConfig).not.toContain('process.env.VERCEL === "1"');
  });

  it("registers SW manually from client component", () => {
    expect(nextConfig).toContain("register: false");
  });
});
