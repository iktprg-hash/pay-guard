import { describe, expect, it } from "vitest";
import { isActivePro } from "@/lib/auth/subscription";

describe("isActivePro", () => {
  it("returns false for free tier", () => {
    expect(isActivePro({ tier: "free", expiresAt: null })).toBe(false);
  });

  it("returns true for pro without expiry", () => {
    expect(isActivePro({ tier: "pro", expiresAt: null })).toBe(true);
  });

  it("returns false when pro subscription expired", () => {
    expect(
      isActivePro({
        tier: "pro",
        expiresAt: "2020-01-01T00:00:00.000Z",
      })
    ).toBe(false);
  });

  it("returns true when pro subscription is in the future", () => {
    expect(
      isActivePro({
        tier: "pro",
        expiresAt: "2099-01-01T00:00:00.000Z",
      })
    ).toBe(true);
  });
});
