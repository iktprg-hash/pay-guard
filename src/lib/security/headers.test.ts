import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  getSecurityHeaders,
  SECURITY_HEADERS,
} from "@/lib/security/headers";

describe("SECURITY_HEADERS", () => {
  it("includes core hardening headers", () => {
    const keys = SECURITY_HEADERS.map((h) => h.key);
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Content-Security-Policy");
  });

  it("allows supabase and xai in connect-src", () => {
    const csp = buildContentSecurityPolicy({
      production: true,
      supabaseHost: "abc.supabase.co",
    });
    expect(csp).toContain("api.x.ai");
    expect(csp).toContain("abc.supabase.co");
  });
});

describe("buildContentSecurityPolicy", () => {
  it("omits unsafe-eval in production", () => {
    const csp = buildContentSecurityPolicy({ production: true });
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("object-src 'none'");
  });

  it("allows unsafe-eval in development", () => {
    const csp = buildContentSecurityPolicy({ production: false });
    expect(csp).toContain("unsafe-eval");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("getSecurityHeaders production includes HSTS", () => {
    const headers = getSecurityHeaders({ production: true });
    expect(headers.some((h) => h.key === "Strict-Transport-Security")).toBe(
      true
    );
  });
});
