import { describe, expect, it } from "vitest";
import { formatMoney, getCurrency } from "./locale-config";

describe("locale-config", () => {
  it("uses RUB for ru locale", () => {
    expect(getCurrency("ru")).toBe("RUB");
    expect(formatMoney(1500, "ru")).toMatch(/1[\s\u00a0]?500/);
    expect(formatMoney(1500, "ru")).toMatch(/₽|RUB/);
  });

  it("uses CZK for cs locale", () => {
    expect(getCurrency("cs")).toBe("CZK");
    expect(formatMoney(1500, "cs")).toMatch(/1[\s\u00a0]?500/);
  });
});
