import { describe, expect, it } from "vitest";
import type { FinancialProfile } from "@/lib/types/financial";
import {
  assessRecommendationReadiness,
  hasMinimumRecommendationData,
  profileHasCriticalDebt,
  userMentionedUnstableIncome,
  userWantsFullAnalysis,
} from "@/lib/grok/recommendation-readiness";

const TODAY = new Date("2026-06-11");

function profile(overrides: Partial<FinancialProfile>): FinancialProfile {
  return {
    availableFunds: 0,
    debts: [],
    ...overrides,
  };
}

describe("recommendation-readiness", () => {
  it("detects critical housing debt", () => {
    const p = profile({
      availableFunds: 10_000,
      debts: [
        {
          id: "1",
          creditor: "Nájem",
          amount: 15_000,
          category: "housing",
          criticalDate: "2026-06-12",
        },
      ],
    });

    expect(profileHasCriticalDebt(p, TODAY)).toBe(true);
  });

  it("is ready for quick recommendation with funds + one debt", () => {
    const p = profile({
      availableFunds: 8_000,
      debts: [
        {
          id: "1",
          creditor: "ČEZ",
          amount: 3_000,
          category: "utilities",
          dueDate: "2026-06-20",
        },
      ],
    });

    const assessment = assessRecommendationReadiness(p);

    expect(hasMinimumRecommendationData(p)).toBe(true);
    expect(assessment.canRecommend).toBe(true);
    expect(assessment.mode).toBe("quick");
    expect(assessment.shouldAutoDeliver).toBe(true);
  });

  it("auto-delivers immediately when critical debt and funds exist", () => {
    const assessment = assessRecommendationReadiness(
      profile({
        availableFunds: 5_000,
        debts: [
          {
            id: "1",
            creditor: "Exekuce",
            amount: 20_000,
            category: "fines",
          },
        ],
      }),
      { today: TODAY }
    );

    expect(assessment.hasCriticalDebt).toBe(true);
    expect(assessment.shouldAutoDeliver).toBe(true);
  });

  it("blocks full plan until income when user asks for detailed analysis", () => {
    const assessment = assessRecommendationReadiness(
      profile({
        availableFunds: 12_000,
        debts: [
          {
            id: "1",
            creditor: "Bank",
            amount: 5_000,
            category: "loans",
          },
        ],
      }),
      { lastUserMessage: "Chci podrobný dlouhodobý plán" }
    );

    expect(userWantsFullAnalysis("Chci podrobný dlouhodobý plán")).toBe(true);
    expect(assessment.canRecommend).toBe(false);
    expect(assessment.shouldAskIncome).toBe(true);
  });

  it("does not require income for quick mode", () => {
    const assessment = assessRecommendationReadiness(
      profile({
        availableFunds: 12_000,
        debts: [
          {
            id: "1",
            creditor: "Nájem",
            amount: 14_000,
            category: "housing",
            criticalDate: "2026-06-13",
          },
        ],
      }),
      { today: TODAY }
    );

    expect(assessment.canRecommend).toBe(true);
    expect(assessment.shouldAskIncome).toBe(false);
  });

  it("detects unstable income mentions", () => {
    expect(userMentionedUnstableIncome("Příjem je nestabilní")).toBe(true);
    expect(userMentionedUnstableIncome("Stabilní mzda")).toBe(false);
  });
});
