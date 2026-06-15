import { describe, expect, it } from "vitest";
import { formatMoney, getCurrency } from "./locale-config";

describe("locale-config — Czech market", () => {
  it("uses CZK for all app locales", () => {
    expect(getCurrency("cs")).toBe("CZK");
    expect(getCurrency("ru")).toBe("CZK");
    expect(getCurrency("en")).toBe("CZK");
  });

  it("formats CZK for cs locale", () => {
    expect(formatMoney(1500, "cs")).toMatch(/1[\s\u00a0]?500/);
    expect(formatMoney(1500, "cs")).toMatch(/Kč|CZK/i);
  });

  it("formats CZK for ru locale (not RUB)", () => {
    expect(formatMoney(1500, "ru")).toMatch(/1[\s\u00a0]?500/);
    expect(formatMoney(1500, "ru")).not.toMatch(/₽/);
    expect(formatMoney(1500, "ru")).toMatch(/Kč|CZK/i);
  });
});
