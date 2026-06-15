import { describe, expect, it } from "vitest";
import {
  convertToCzk,
  enrichProfileFromMessage,
  parseForeignAmountToCzk,
} from "@/lib/financial/currency-convert";

describe("currency-convert", () => {
  it("converts EUR to CZK", () => {
    expect(convertToCzk(100, "EUR")).toBe(2520);
  });

  it("keeps CZK unchanged", () => {
    expect(convertToCzk(45_000, "CZK")).toBe(45_000);
  });

  it("parses foreign amount strings", () => {
    expect(parseForeignAmountToCzk("500 EUR")).toBe(12600);
    expect(parseForeignAmountToCzk("45 000 ₽")).toBe(12150);
  });

  it("enriches profile when foreign amount was stored raw", () => {
    const profile = {
      availableFunds: 500,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      debts: [{ amount: 500 }],
    };
    const enriched = enrichProfileFromMessage(profile, "mám 500 EUR");
    expect(enriched.availableFunds).toBe(12600);
    expect(enriched.debts[0]?.amount).toBe(12600);
  });
});
