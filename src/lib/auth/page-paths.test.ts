import { describe, expect, it } from "vitest";
import {
  isGuestOnlyPagePath,
  isPublicPagePath,
} from "@/lib/auth/page-paths";

describe("page-paths", () => {
  it("marks auth and pricing pages as public", () => {
    expect(isPublicPagePath("/cs/login")).toBe(true);
    expect(isPublicPagePath("/en/pricing")).toBe(true);
    expect(isPublicPagePath("/cs/settings")).toBe(false);
  });

  it("marks guest-only pages", () => {
    expect(isGuestOnlyPagePath("/cs/login")).toBe(true);
    expect(isGuestOnlyPagePath("/cs/reset-password")).toBe(false);
  });
});
