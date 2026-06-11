import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "@/lib/security/headers";

describe("SECURITY_HEADERS", () => {
  it("includes core hardening headers", () => {
    const keys = SECURITY_HEADERS.map((h) => h.key);
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Content-Security-Policy");
  });

  it("allows supabase and xai in connect-src", () => {
    const csp = SECURITY_HEADERS.find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toContain("api.x.ai");
    expect(csp?.value).toMatch(/supabase\.co/);
  });
});
