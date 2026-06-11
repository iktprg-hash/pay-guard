import { describe, expect, it } from "vitest";
import { minimizeProfileForGrok } from "@/lib/grok/minimize-profile";

describe("minimizeProfileForGrok", () => {
  it("strips free-text notes from debts", () => {
    const result = minimizeProfileForGrok({
      availableFunds: 5000,
      debts: [
        {
          id: "d1",
          creditor: "Landlord",
          amount: 12000,
          notes: "secret account number 123",
          criticalNote: "eviction tomorrow",
          category: "housing",
        },
      ],
    });

    expect(result.debts[0]).not.toHaveProperty("notes");
    expect(result.debts[0]).not.toHaveProperty("criticalNote");
    expect(result.debts[0].creditor).toBe("Landlord");
    expect(result.availableFunds).toBe(5000);
  });
});
