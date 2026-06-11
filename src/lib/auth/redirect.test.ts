import { describe, expect, it } from "vitest";
import { resolveAuthNext } from "@/lib/auth/redirect";

describe("resolveAuthNext", () => {
  it("returns locale home when next is missing", () => {
    expect(resolveAuthNext(null, "cs")).toBe("/cs");
  });

  it("blocks external and protocol-relative URLs", () => {
    expect(resolveAuthNext("https://evil.com", "cs")).toBe("/cs");
    expect(resolveAuthNext("//evil.com", "cs")).toBe("/cs");
  });

  it("blocks manifest and api paths", () => {
    expect(resolveAuthNext("/manifest.webmanifest", "cs")).toBe("/cs");
    expect(resolveAuthNext("/cs/manifest.webmanifest", "cs")).toBe("/cs");
    expect(resolveAuthNext("/api/chat", "cs")).toBe("/cs");
    expect(resolveAuthNext("/auth/confirm", "cs")).toBe("/cs");
  });

  it("blocks login and register loops", () => {
    expect(resolveAuthNext("/cs/login", "cs")).toBe("/cs");
    expect(resolveAuthNext("/cs/register", "cs")).toBe("/cs");
  });

  it("allows safe internal locale paths", () => {
    expect(resolveAuthNext("/cs/consultations", "cs")).toBe("/cs/consultations");
    expect(resolveAuthNext("/en/settings", "en")).toBe("/en/settings");
  });

  it("allows reset-password after recovery", () => {
    expect(resolveAuthNext("/cs/reset-password", "cs")).toBe("/cs/reset-password");
  });

  it("blocks forgot-password loops for signed-in redirect", () => {
    expect(resolveAuthNext("/cs/forgot-password", "cs")).toBe("/cs/forgot-password");
  });

  it("rejects javascript URLs", () => {
    expect(resolveAuthNext("javascript:alert(1)", "cs")).toBe("/cs");
  });

  it("rejects paths without locale prefix", () => {
    expect(resolveAuthNext("/consultations", "cs")).toBe("/cs");
  });

  it("preserves query-safe paths with locale", () => {
    expect(resolveAuthNext("/ru/settings", "ru")).toBe("/ru/settings");
  });
});
