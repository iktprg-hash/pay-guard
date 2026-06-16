import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildContentSecurityPolicy,
  getSecurityHeaders,
  getSupabaseHost,
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
  it("omits unsafe-eval and unsafe-inline in production script-src", () => {
    const csp = buildContentSecurityPolicy({ production: true });
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("object-src 'none'");
  });

  it("uses nonce in production script-src when provided", () => {
    const csp = buildContentSecurityPolicy({
      production: true,
      nonce: "abc123",
    });
    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("allows unsafe-eval in development", () => {
    const csp = buildContentSecurityPolicy({ production: false });
    expect(csp).toContain("unsafe-eval");
    expect(csp).toContain("unsafe-inline");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("getSecurityHeaders production includes HSTS", () => {
    const headers = getSecurityHeaders({ production: true });
    expect(headers.some((h) => h.key === "Strict-Transport-Security")).toBe(
      true
    );
  });
});

describe("getSupabaseHost", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("warns in production when falling back to wildcard host", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NODE_ENV = "production";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(getSupabaseHost()).toBe("*.supabase.co");
    expect(errorSpy).toHaveBeenCalledWith(
      "[security] NEXT_PUBLIC_SUPABASE_URL is not set — CSP connect-src falling back to *.supabase.co"
    );
  });
});
