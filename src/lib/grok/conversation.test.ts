import { describe, expect, it } from "vitest";
import { detectConversationStage } from "@/lib/grok/conversation";
import type { FinancialProfile } from "@/lib/types/financial";

describe("detectConversationStage — quick flow", () => {
  it("starts with greeting on first message", () => {
    expect(
      detectConversationStage(
        { availableFunds: 0, debts: [] },
        { messageCount: 1 }
      )
    ).toBe("greeting");
  });

  it("jumps to quick_recommend on first message when minimum data is present", () => {
    const profile: FinancialProfile = {
      availableFunds: 45_000,
      debts: [
        {
          id: "rent",
          creditor: "Nájem",
          amount: 16_000,
          category: "housing",
          dueDate: "2026-06-15",
        },
        {
          id: "micro",
          creditor: "Mikrozápůjčka",
          amount: 32_000,
          category: "loans",
          interestRate: 45,
        },
      ],
    };

    expect(
      detectConversationStage(profile, { messageCount: 1 })
    ).toBe("quick_recommend");
  });

  it("moves to quick_recommend when minimum data is present", () => {
    const profile: FinancialProfile = {
      availableFunds: 10_000,
      debts: [
        {
          id: "1",
          creditor: "Nájem",
          amount: 12_000,
          category: "housing",
          criticalDate: "2026-06-12",
        },
      ],
    };

    expect(
      detectConversationStage(profile, { messageCount: 3 })
    ).toBe("quick_recommend");
  });

  it("asks for funds when debt exists but availableFunds missing", () => {
    expect(
      detectConversationStage(
        {
          availableFunds: 0,
          debts: [
            {
              id: "1",
              creditor: "ČEZ",
              amount: 4_000,
              category: "utilities",
            },
          ],
        },
        { messageCount: 2 }
      )
    ).toBe("available_funds");
  });
});
