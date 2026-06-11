import { describe, expect, it, afterEach } from "vitest";
import { getSiteOriginFromEnv } from "@/lib/site/url";

describe("getSiteOriginFromEnv", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    process.env = {
      ...env,
      NEXT_PUBLIC_SITE_URL: "https://payguard.cz",
      VERCEL_URL: "pay-guard.vercel.app",
    };
    expect(getSiteOriginFromEnv()).toBe("https://payguard.cz");
  });

  it("uses VERCEL_URL when site url unset", () => {
    process.env = { ...env, VERCEL_URL: "pay-guard-abc.vercel.app" };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteOriginFromEnv()).toBe("https://pay-guard-abc.vercel.app");
  });

  it("returns null in local dev without env", () => {
    process.env = { ...env };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    expect(getSiteOriginFromEnv()).toBeNull();
  });
});
