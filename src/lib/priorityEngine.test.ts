/**
 * Priority Engine — unified test suite
 *
 * Single source of truth for Priority Engine unit and integration tests.
 * Run: npm test -- src/lib/priorityEngine.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  analyzeDebt,
  calculateLifeBufferPercent,
  resolveLifeBufferPercent,
  runPriorityEngine,
  daysBetween,
  isExecutionRisk,
  nearestDeadlineDays,
  hasMultipleDeadlines,
  PRIORITY_CONSTANTS,
} from "@/services/priorityEngine";
import type { Debt, FinancialProfile } from "@/lib/types/financial";

const TODAY = new Date("2026-06-11");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function debt(overrides: Partial<Debt> & Pick<Debt, "id" | "creditor" | "amount">): Debt {
  return { category: "other", ...overrides };
}

function profile(
  funds: number,
  debts: Debt[],
  stability: FinancialProfile["incomeStability"] = "stable"
): FinancialProfile {
  return { availableFunds: funds, incomeStability: stability, debts };
}

function rec(result: ReturnType<typeof runPriorityEngine>, debtId: string) {
  return result.recommendations.find((r) => r.debtId === debtId);
}

// ─── Suite ─────────────────────────────────────────────────────────────────

describe("Priority Engine", () => {
  describe("utilities", () => {
    it("computes days between two dates", () => {
      expect(daysBetween(TODAY, new Date("2026-06-14"))).toBe(3);
    });

    it("picks the nearest deadline when multiple dates exist", () => {
      expect(hasMultipleDeadlines(10, 5)).toBe(true);
      expect(nearestDeadlineDays(10, 5)).toBe(5);
      expect(nearestDeadlineDays(3, 14)).toBe(3);
    });
  });

  describe("life buffer", () => {
    describe("calculateLifeBufferPercent", () => {
      it("returns 20% for stable income", () => {
        expect(calculateLifeBufferPercent("stable")).toBe(0.2);
      });

      it("returns 28% for variable income", () => {
        expect(calculateLifeBufferPercent("variable")).toBe(0.28);
      });

      it("returns 35% for uncertain income", () => {
        expect(calculateLifeBufferPercent("uncertain")).toBe(0.35);
      });

      it("returns 25% when income stability is unknown", () => {
        expect(calculateLifeBufferPercent(undefined)).toBe(0.25);
      });
    });

    describe("resolveLifeBufferPercent", () => {
      it("reduces buffer when a level-0 debt exists with low funds", () => {
        expect(
          resolveLifeBufferPercent("stable", {
            hasLevel0Debt: true,
            availableFunds: 10_000,
          })
        ).toBe(PRIORITY_CONSTANTS.BUFFER_CRITICAL_LOW_STABLE);
      });

      it("keeps standard buffer without critical debts", () => {
        expect(
          resolveLifeBufferPercent("stable", {
            hasLevel0Debt: false,
            availableFunds: 10_000,
          })
        ).toBe(0.2);
      });

      it("keeps standard buffer when funds exceed the critical threshold", () => {
        expect(
          resolveLifeBufferPercent("stable", {
            hasLevel0Debt: true,
            availableFunds: 20_000,
          })
        ).toBe(0.2);
      });
    });

    it("reserves standard 20% buffer with sufficient funds and no critical pressure", () => {
      const result = runPriorityEngine(
        profile(25_000, [
          debt({
            id: "najem",
            creditor: "REMAX — nájem Praha 7",
            amount: 14_500,
            category: "housing",
            dueDate: "2026-06-28",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.lifeBufferPercent).toBe(PRIORITY_CONSTANTS.BUFFER_STABLE);
      expect(result.lifeBuffer).toBe(5_000);
      expect(result.spendableFunds).toBe(20_000);
      expect(result.warnings.some((w) => w.includes("Rezerva"))).toBe(true);
    });

    it("reduces buffer to 8% with one critical debt and low available funds", () => {
      const result = runPriorityEngine(
        profile(10_000, [
          debt({
            id: "najem",
            creditor: "Bořivojova — nájem",
            amount: 12_000,
            category: "housing",
            criticalDate: "2026-06-13",
            criticalNote: "Výpověď z bytu",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.lifeBufferPercent).toBe(
        PRIORITY_CONSTANTS.BUFFER_CRITICAL_LOW_STABLE
      );
      expect(result.lifeBuffer).toBe(800);
      expect(result.spendableFunds).toBe(9_200);
      expect(result.warnings.some((w) => w.includes("snížena"))).toBe(true);
    });

    it("uses emergency buffer when two or more critical debts exist with low funds", () => {
      const result = runPriorityEngine(
        profile(8_000, [
          debt({
            id: "najem",
            creditor: "Nájem — Vinohrady",
            amount: 10_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
          debt({
            id: "exekuce",
            creditor: "Exekutorský úřad Praha",
            amount: 6_000,
            category: "fines",
            dueDate: "2026-06-13",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.lifeBufferPercent).toBe(PRIORITY_CONSTANTS.BUFFER_EMERGENCY_STABLE);
      expect(result.lifeBuffer).toBe(640);
      expect(result.warnings.some((w) => w.includes("Emergency"))).toBe(true);
    });

    it("reserves 35% buffer for uncertain income stability", () => {
      const result = runPriorityEngine(
        profile(10_000, [debt({ id: "x", creditor: "Test", amount: 1_000 })], "uncertain"),
        "cs",
        TODAY
      );

      expect(result.lifeBuffer).toBe(3_500);
      expect(result.spendableFunds).toBe(6_500);
    });
  });

  describe("execution risk detection", () => {
    it("detects execution risk from Czech note keywords", () => {
      expect(
        isExecutionRisk(
          debt({
            id: "e",
            creditor: "Exekutor",
            amount: 5_000,
            criticalNote: "Soudní exekuce na účet",
          })
        )
      ).toBe(true);
    });

    it("treats fines and taxes categories as execution risk", () => {
      expect(
        isExecutionRisk(debt({ id: "f", creditor: "Úřad", amount: 2_000, category: "fines" }))
      ).toBe(true);
      expect(
        isExecutionRisk(
          debt({ id: "t", creditor: "Finanční úřad", amount: 3_000, category: "taxes" })
        )
      ).toBe(true);
    });

    it("detects FSSP / bailiff keywords in Russian notes", () => {
      expect(
        isExecutionRisk(
          debt({
            id: "fssp",
            creditor: "ФССП",
            amount: 15_000,
            criticalNote: "Арест счёта судебным приставом",
          })
        )
      ).toBe(true);
    });
  });

  describe("analyzeDebt — priority levels", () => {
    it("assigns level 0 to imminent essential and execution-risk debts", () => {
      const rent = analyzeDebt(
        debt({
          id: "najem",
          creditor: "Nájem",
          amount: 15_000,
          category: "housing",
          criticalDate: "2026-06-13",
          criticalNote: "Vystěhování",
        }),
        TODAY
      );
      const overdueRent = analyzeDebt(
        debt({
          id: "najem2",
          creditor: "Nájem",
          amount: 10_000,
          category: "housing",
          dueDate: "2026-06-01",
        }),
        TODAY
      );
      const utilities = analyzeDebt(
        debt({
          id: "plyn",
          creditor: "Pražská plynárenská",
          amount: 5_200,
          category: "utilities",
          criticalDate: "2026-06-13",
          criticalNote: "Hrozí odpojení plynu",
        }),
        TODAY
      );
      const exekuce = analyzeDebt(
        debt({
          id: "ex",
          creditor: "Městský úřad — exekuční pokuta",
          amount: 18_000,
          category: "fines",
        }),
        TODAY
      );

      expect(rent.level).toBe(0);
      expect(rent.urgencyScore).toBeGreaterThan(100);
      expect(overdueRent.level).toBe(0);
      expect(utilities.level).toBe(0);
      expect(utilities.factors).toContain("critical_imminent");
      expect(exekuce.level).toBe(0);
      expect(exekuce.factors).toContain("execution_risk");
    });

    it("assigns level 1 to debts due within 7 days or overdue non-essential debts", () => {
      expect(
        analyzeDebt(
          debt({
            id: "ele",
            creditor: "Elektřina",
            amount: 3_000,
            category: "utilities",
            dueDate: "2026-06-16",
          }),
          TODAY
        ).level
      ).toBe(1);

      expect(
        analyzeDebt(
          debt({
            id: "pujcka",
            creditor: "Air Bank — osobní úvěr",
            amount: 18_000,
            category: "loans",
            dueDate: "2026-06-13",
          }),
          TODAY
        ).level
      ).toBe(1);

      expect(
        analyzeDebt(
          debt({
            id: "moneta",
            creditor: "Moneta Money Bank",
            amount: 9_500,
            category: "loans",
            dueDate: "2026-06-01",
          }),
          TODAY
        ).level
      ).toBe(1);

      expect(
        analyzeDebt(
          debt({
            id: "karta",
            creditor: "Visa — ČSOB",
            amount: 8_000,
            category: "credit_card",
            dueDate: "2026-06-13",
          }),
          TODAY
        ).level
      ).toBe(1);
    });

    it("assigns level 2 to debts due within 30 days", () => {
      expect(
        analyzeDebt(
          debt({
            id: "pujcka",
            creditor: "Půjčka",
            amount: 5_000,
            category: "loans",
            dueDate: "2026-07-01",
          }),
          TODAY
        ).level
      ).toBe(2);
    });

    it("assigns level 3 to low-urgency debts without near deadlines", () => {
      expect(
        analyzeDebt(
          debt({
            id: "karta",
            creditor: "Visa",
            amount: 8_000,
            category: "credit_card",
          }),
          TODAY
        ).level
      ).toBe(3);
    });
  });

  describe("allocation", () => {
    it("covers at least 70% of the most urgent level-0 rent due day after tomorrow", () => {
      const result = runPriorityEngine(
        profile(12_000, [
          debt({
            id: "najem",
            creditor: "U Družstva — nájem Karlín",
            amount: 10_000,
            category: "housing",
            criticalDate: "2026-06-13",
            criticalNote: "Hrozí výpověď",
          }),
          debt({
            id: "ele",
            creditor: "PRE — elektřina",
            amount: 3_200,
            category: "utilities",
            criticalDate: "2026-06-18",
          }),
        ]),
        "cs",
        TODAY
      );

      const najem = rec(result, "najem");

      expect(najem?.priorityLevel).toBe(0);
      expect(najem?.recommendedAmount).toBeGreaterThanOrEqual(7_000);
      expect(najem!.recommendedAmount).toBeGreaterThan(
        rec(result, "ele")?.recommendedAmount ?? 0
      );
    });

    it("prioritises the nearest level-0 deadline over less urgent critical debts", () => {
      const result = runPriorityEngine(
        profile(10_000, [
          debt({
            id: "najem",
            creditor: "Nájem — výpověď",
            amount: 12_000,
            category: "housing",
            criticalDate: "2026-06-12",
            criticalNote: "Výpověď z bytu",
          }),
          debt({
            id: "ele",
            creditor: "ČEZ — elektřina",
            amount: 5_000,
            category: "utilities",
            criticalDate: "2026-06-16",
          }),
        ]),
        "cs",
        TODAY
      );

      const najem = rec(result, "najem");
      const ele = rec(result, "ele");

      expect(najem?.recommendedAmount).toBeGreaterThan(0);
      expect(najem!.recommendedAmount).toBeGreaterThan(ele?.recommendedAmount ?? 0);
      expect(najem!.recommendedAmount).toBeGreaterThanOrEqual(8_400);
    });

    it("prioritises critical rent over a distant credit card", () => {
      const result = runPriorityEngine(
        profile(10_000, [
          debt({
            id: "karta",
            creditor: "Visa",
            amount: 5_000,
            category: "credit_card",
            dueDate: "2026-12-01",
          }),
          debt({
            id: "najem",
            creditor: "Nájem",
            amount: 15_000,
            category: "housing",
            criticalDate: "2026-06-13",
            criticalNote: "Vystěhování",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.recommendations[0]?.creditor).toBe("Nájem");
      expect(result.recommendations[0]?.priorityLevel).toBe(0);
    });

    it("prioritises execution-risk debt over non-critical debts", () => {
      const result = runPriorityEngine(
        profile(3_000, [
          debt({
            id: "exekuce",
            creditor: "Exekutor Města",
            amount: 8_000,
            category: "fines",
            criticalNote: "Exekuce",
            criticalDate: "2026-06-20",
          }),
          debt({
            id: "karta",
            creditor: "Visa",
            amount: 3_000,
            category: "credit_card",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.recommendations[0]?.creditor).toBe("Exekutor Města");
      expect(result.recommendations[0]?.priorityLevel).toBe(0);
      expect(result.recommendations[0]?.explanation).toMatch(/exeku/i);
    });

    it("aggressively pays the most expensive level-1 debt after level 0 is covered", () => {
      const result = runPriorityEngine(
        profile(15_000, [
          debt({
            id: "najem",
            creditor: "Nájem Brno-střed",
            amount: 8_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
          debt({
            id: "micro",
            creditor: "SMS půjčka — Provident",
            amount: 4_000,
            category: "loans",
            interestRate: 42,
            dueDate: "2026-06-17",
          }),
          debt({
            id: "bank",
            creditor: "ČSOB — spotřebitelský úvěr",
            amount: 3_000,
            category: "loans",
            interestRate: 9,
            dueDate: "2026-06-18",
          }),
        ]),
        "cs",
        TODAY
      );

      const micro = rec(result, "micro");
      const bank = rec(result, "bank");
      const level1Total =
        (micro?.recommendedAmount ?? 0) + (bank?.recommendedAmount ?? 0);

      expect(rec(result, "najem")?.recommendedAmount).toBeGreaterThanOrEqual(7_000);
      expect(micro!.recommendedAmount).toBeGreaterThan(bank?.recommendedAmount ?? 0);
      expect(micro!.recommendedAmount / level1Total).toBeGreaterThanOrEqual(0.7);
    });

    it("aggressively pays the most expensive level-1 debt when no level-0 debts exist", () => {
      const result = runPriorityEngine(
        profile(12_000, [
          debt({
            id: "micro",
            creditor: "Rychlá půjčka online",
            amount: 7_000,
            category: "loans",
            interestRate: 35,
            dueDate: "2026-06-17",
          }),
          debt({
            id: "bank",
            creditor: "Air Bank — úvěr",
            amount: 4_000,
            category: "loans",
            interestRate: 8,
            dueDate: "2026-06-18",
          }),
        ]),
        "cs",
        TODAY
      );

      const micro = rec(result, "micro");
      const bank = rec(result, "bank");
      const level1Total =
        (micro?.recommendedAmount ?? 0) + (bank?.recommendedAmount ?? 0);

      expect(result.spendableFunds).toBe(9_600);
      expect(micro!.recommendedAmount).toBeGreaterThan(bank?.recommendedAmount ?? 0);
      expect(micro!.recommendedAmount / level1Total).toBeGreaterThanOrEqual(0.7);
    });

    it("splits funds proportionally between debts on the same level", () => {
      const result = runPriorityEngine(
        profile(18_000, [
          debt({
            id: "a",
            creditor: "Home Credit — splátka",
            amount: 6_000,
            category: "loans",
            dueDate: "2026-07-01",
          }),
          debt({
            id: "b",
            creditor: "Zonky — půjčka",
            amount: 6_000,
            category: "loans",
            dueDate: "2026-07-05",
          }),
        ]),
        "cs",
        TODAY
      );

      const a = rec(result, "a");
      const b = rec(result, "b");

      expect(a?.priorityLevel).toBe(2);
      expect(b?.priorityLevel).toBe(2);
      expect(Math.abs(a!.recommendedAmount - b!.recommendedAmount)).toBeLessThan(2_500);
    });

    it("does not let one oversized debt consume the entire spendable pool", () => {
      const result = runPriorityEngine(
        profile(20_000, [
          debt({
            id: "hypo",
            creditor: "Hypoteční banka — hypotéka",
            amount: 180_000,
            category: "loans",
            dueDate: "2026-07-08",
          }),
          debt({
            id: "tel",
            creditor: "O2 — mobil",
            amount: 4_500,
            category: "other",
            dueDate: "2026-07-10",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(rec(result, "hypo")?.recommendedAmount).toBeLessThan(result.spendableFunds);
      expect(rec(result, "tel")?.recommendedAmount).toBeGreaterThanOrEqual(500);
    });

    it("applies minimum payments before proportional allocation", () => {
      const result = runPriorityEngine(
        profile(14_000, [
          debt({
            id: "karta",
            creditor: "Visa — Komerční banka",
            amount: 7_000,
            category: "credit_card",
            dueDate: "2026-12-01",
          }),
          debt({
            id: "pujcka",
            creditor: "Raiffeisenbank — úvěr",
            amount: 16_000,
            category: "loans",
            dueDate: "2026-06-16",
            minimumPayment: 2_800,
          }),
        ]),
        "cs",
        TODAY
      );

      expect(rec(result, "pujcka")?.recommendedAmount).toBeGreaterThanOrEqual(2_800);
    });

    it("allocates partial amount when funds are below the minimum payment", () => {
      const result = runPriorityEngine(
        profile(8_000, [
          debt({
            id: "pujcka",
            creditor: "Moneta — splátka úvěru",
            amount: 9_000,
            category: "loans",
            dueDate: "2026-06-14",
            minimumPayment: 9_000,
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.spendableFunds).toBe(6_400);
      expect(result.recommendations[0]?.recommendedAmount).toBe(6_400);
    });

    it("never allocates more than available funds", () => {
      const result = runPriorityEngine(
        profile(5_000, [
          debt({
            id: "a",
            creditor: "Nájem",
            amount: 10_000,
            category: "housing",
            dueDate: "2026-06-12",
          }),
          debt({
            id: "b",
            creditor: "Elektřina",
            amount: 10_000,
            category: "utilities",
            dueDate: "2026-06-13",
          }),
          debt({
            id: "c",
            creditor: "Půjčka",
            amount: 10_000,
            category: "loans",
            dueDate: "2026-06-20",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.totalAllocated).toBeLessThanOrEqual(5_000);
      expect(result.remainingFunds + result.totalAllocated).toBe(5_000);
    });
  });

  describe("warnings and input safety", () => {
    it("warns when multiple critical debts cannot all be fully paid", () => {
      const result = runPriorityEngine(
        profile(7_000, [
          debt({
            id: "najem",
            creditor: "Nájem — Žižkov",
            amount: 11_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
          debt({
            id: "plyn",
            creditor: "Pražská plynárenská",
            amount: 8_500,
            category: "utilities",
            criticalDate: "2026-06-13",
            criticalNote: "Hrozí odpojení",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.warnings.some((w) => w.includes("2 kritick"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("Emergency"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("nepokryt"))).toBe(true);
    });

    it("warns when an execution-risk debt receives less than 50% payment", () => {
      const result = runPriorityEngine(
        profile(5_000, [
          debt({
            id: "exekuce",
            creditor: "Soudní exekutor JUDr. Novák",
            amount: 24_000,
            category: "fines",
            dueDate: "2026-06-14",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(rec(result, "exekuce")?.recommendedAmount).toBeLessThan(12_000);
      expect(result.warnings.some((w) => w.includes("Exekuce"))).toBe(true);
    });

    it("sanitizes NaN and negative amounts to safe zero behaviour", () => {
      const result = runPriorityEngine(
        {
          availableFunds: Number.NaN,
          incomeStability: "stable",
          debts: [
            { id: "bad", creditor: "Neplatný dluh", amount: -2_000, category: "other" },
            { id: "nan", creditor: "NaN úrok", amount: Number.NaN, category: "loans" },
          ],
        },
        "cs",
        TODAY
      );

      expect(result.spendableFunds).toBe(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("returns no recommendations when available funds are zero", () => {
      const result = runPriorityEngine(
        profile(0, [
          debt({
            id: "najem",
            creditor: "Nájem — Karlín",
            amount: 9_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
        ]),
        "cs",
        TODAY
      );

      expect(result.recommendations).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("volné prostředky"))).toBe(true);
    });

    it("handles an empty debt list gracefully", () => {
      const result = runPriorityEngine(profile(5_000, []), "cs", TODAY);

      expect(result.recommendations).toHaveLength(0);
      expect(result.summary).toMatch(/dluhy|долг|debts/i);
    });
  });

  describe("integration", () => {
    it("localises summary and warnings in Czech and Russian", () => {
      const cs = runPriorityEngine(
        profile(10_000, [
          debt({
            id: "najem",
            creditor: "Nájem Vinohrady",
            amount: 9_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
        ]),
        "cs",
        TODAY
      );

      const ru = runPriorityEngine(
        profile(10_000, [
          debt({
            id: "najem",
            creditor: "Аренда — Москва",
            amount: 9_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
        ]),
        "ru",
        TODAY
      );

      expect(cs.summary).toMatch(/Priorita|Kč/i);
      expect(cs.warnings.some((w) => w.includes("Kč") || w.includes("snížena"))).toBe(true);
      expect(ru.summary).toMatch(/Приоритет|Kč/i);
      expect(
        ru.warnings.some(
          (w) =>
            w.includes("Kč") ||
            w.includes("снижен") ||
            w.includes("Emergency")
        )
      ).toBe(true);
    });

    it("allocates across mixed priority levels 0, 1, and 2 in one realistic scenario", () => {
      const result = runPriorityEngine(
        profile(28_000, [
          debt({
            id: "najem",
            creditor: "Nájem — Holešovice",
            amount: 12_500,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
          debt({
            id: "ele",
            creditor: "ČEZ — elektřina",
            amount: 3_600,
            category: "utilities",
            dueDate: "2026-06-16",
          }),
          debt({
            id: "pujcka",
            creditor: "Air Bank",
            amount: 8_000,
            category: "loans",
            dueDate: "2026-07-02",
          }),
        ]),
        "cs",
        TODAY
      );

      const levels = new Set(result.recommendations.map((r) => r.priorityLevel));

      expect(result.recommendations[0]?.priorityLevel).toBe(0);
      expect(levels.has(1)).toBe(true);
      expect(levels.has(2)).toBe(true);
      expect(result.totalAllocated + result.remainingFunds).toBe(28_000);
    });

    it("includes explanation and priorityLevel on every recommendation", () => {
      const result = runPriorityEngine(
        profile(
          20_000,
          [
            debt({
              id: "najem",
              creditor: "Nájem",
              amount: 12_000,
              category: "housing",
              dueDate: "2026-06-18",
              minimumPayment: 12_000,
            }),
          ],
          "variable"
        ),
        "cs",
        TODAY
      );

      for (const recommendation of result.recommendations) {
        expect(recommendation.priorityLevel).toBeGreaterThanOrEqual(0);
        expect(recommendation.priorityLevel).toBeLessThanOrEqual(3);
        expect(recommendation.explanation.length).toBeGreaterThan(0);
        expect(recommendation.reason.length).toBeGreaterThan(0);
      }
    });
  });
});
