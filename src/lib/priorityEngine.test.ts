/**
 * Comprehensive unit tests — Priority Engine (Czech scenarios, Kč).
 * Run: npm test -- src/lib/priorityEngine.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  analyzeDebt,
  isExecutionRisk,
  PRIORITY_CONSTANTS,
  runPriorityEngine,
} from "@/services/priorityEngine";
import type { Debt, FinancialProfile } from "@/lib/types/financial";

const TODAY = new Date("2026-06-11");

function debt(
  overrides: Partial<Debt> & Pick<Debt, "id" | "creditor" | "amount">
): Debt {
  return { category: "other", ...overrides };
}

function profile(
  availableFunds: number,
  debts: Debt[],
  incomeStability?: FinancialProfile["incomeStability"]
): FinancialProfile {
  return { availableFunds, incomeStability, debts };
}

describe("Priority Engine — comprehensive unit tests (CZ)", () => {
  describe("life buffer", () => {
    it("reduces life buffer to 10% when level-0 debt exists and funds are below 15 000 Kč", () => {
      const result = runPriorityEngine(
        profile(
          12_000,
          [
            debt({
              id: "najem",
              creditor: "Nájem bytu — Praha 4",
              amount: 18_500,
              category: "housing",
              criticalDate: "2026-06-12",
              criticalNote: "Hrozí výpověď",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      expect(result.lifeBufferPercent).toBe(
        PRIORITY_CONSTANTS.BUFFER_CRITICAL_LOW_STABLE
      );
      expect(result.lifeBuffer).toBe(1_200);
      expect(result.warnings.some((w) => w.includes("snížena"))).toBe(true);
    });

    it("keeps standard 20% life buffer when no level-0 debts are present", () => {
      const result = runPriorityEngine(
        profile(
          25_000,
          [
            debt({
              id: "karta",
              creditor: "Visa Classic — ČSOB",
              amount: 12_000,
              category: "credit_card",
              dueDate: "2026-12-01",
            }),
            debt({
              id: "pujcka",
              creditor: "Moneta Money Bank — spotřební úvěr",
              amount: 35_000,
              category: "loans",
              dueDate: "2026-07-20",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      expect(result.lifeBufferPercent).toBe(PRIORITY_CONSTANTS.BUFFER_STABLE);
      expect(result.lifeBuffer).toBe(5_000);
      expect(result.warnings.some((w) => w.includes("snížena"))).toBe(false);
    });
  });

  describe("priority levels", () => {
    it("does not escalate an ordinary bank loan to level 0 solely for an imminent due date", () => {
      const analysis = analyzeDebt(
        debt({
          id: "pujcka",
          creditor: "Česká spořitelna — spotřební úvěr",
          amount: 45_000,
          category: "loans",
          dueDate: "2026-06-13",
        }),
        TODAY
      );

      expect(analysis.level).toBe(1);
      expect(analysis.factors).not.toContain("execution");
    });

    it("assigns level 0 to housing with an imminent critical eviction deadline", () => {
      const result = runPriorityEngine(
        profile(
          20_000,
          [
            debt({
              id: "najem",
              creditor: "Ubytovna Brno — nájem",
              amount: 14_000,
              category: "housing",
              criticalDate: "2026-06-13",
              criticalNote: "Výpověď z bytu",
            }),
            debt({
              id: "karta",
              creditor: "Visa Classic",
              amount: 8_000,
              category: "credit_card",
              dueDate: "2026-12-01",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      expect(result.recommendations[0]?.creditor).toBe("Ubytovna Brno — nájem");
      expect(result.recommendations[0]?.priorityLevel).toBe(0);
      expect(result.recommendations[0]?.recommendedAmount).toBeGreaterThan(0);
    });

    it("assigns level 0 to utilities with an imminent critical disconnection deadline", () => {
      const analysis = analyzeDebt(
        debt({
          id: "plyn",
          creditor: "Pražská plynárenská — distribuce",
          amount: 5_200,
          category: "utilities",
          criticalDate: "2026-06-13",
          criticalNote: "Hrozí odpojení plynu",
        }),
        TODAY
      );

      expect(analysis.level).toBe(0);
      expect(analysis.factors).toContain("critical_imminent");
    });

    it("treats fines category and execution keywords as level-0 execution risk", () => {
      const pokuta = debt({
        id: "pokuta",
        creditor: "Městský úřad Olomouc",
        amount: 6_500,
        category: "fines",
        dueDate: "2026-07-15",
      });

      const exekuce = debt({
        id: "exekuce",
        creditor: "Soudní exekutor JUDr. Novák",
        amount: 22_000,
        category: "other",
        criticalNote: "Soudní exekuce na bankovní účet",
      });

      const fssp = debt({
        id: "fssp",
        creditor: "Exekutorský úřad",
        amount: 18_000,
        category: "other",
        notes: "ФССП — арест счёта",
      });

      expect(isExecutionRisk(pokuta)).toBe(true);
      expect(analyzeDebt(pokuta, TODAY).level).toBe(0);

      expect(isExecutionRisk(exekuce)).toBe(true);
      expect(analyzeDebt(exekuce, TODAY).level).toBe(0);

      expect(isExecutionRisk(fssp)).toBe(true);
      expect(analyzeDebt(fssp, TODAY).level).toBe(0);
    });

    it("prioritises the nearest deadline when a debt has multiple deadlines", () => {
      const analysis = analyzeDebt(
        debt({
          id: "ele",
          creditor: "ČEZ — elektřina",
          amount: 7_800,
          category: "utilities",
          dueDate: "2026-08-15",
          criticalDate: "2026-06-12",
          criticalNote: "Hrozí odpojení elektřiny",
        }),
        TODAY
      );

      expect(analysis.factors).toContain("multiple_deadlines");
      expect(analysis.level).toBe(0);
      expect(analysis.daysToCritical).toBe(1);
    });
  });

  describe("allocation", () => {
    it("distributes spendable funds proportionally between same-level debts", () => {
      const result = runPriorityEngine(
        profile(
          10_000,
          [
            debt({
              id: "ele",
              creditor: "ČEZ — elektřina",
              amount: 4_200,
              category: "utilities",
              dueDate: "2026-06-14",
            }),
            debt({
              id: "plyn",
              creditor: "Pražská plynárenská",
              amount: 3_100,
              category: "utilities",
              dueDate: "2026-06-15",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      const ele = result.recommendations.find((r) => r.creditor.includes("ČEZ"));
      const plyn = result.recommendations.find((r) =>
        r.creditor.includes("plynárenská")
      );

      expect(result.recommendations).toHaveLength(2);
      expect(ele?.recommendedAmount).toBeGreaterThan(0);
      expect(plyn?.recommendedAmount).toBeGreaterThan(0);

      const allocated =
        (ele?.recommendedAmount ?? 0) + (plyn?.recommendedAmount ?? 0);
      expect(allocated).toBeLessThanOrEqual(result.spendableFunds);
      expect(allocated).toBeGreaterThan(0);
    });

    it("caps allocation weight so a large debt cannot monopolize the entire pool", () => {
      const result = runPriorityEngine(
        profile(
          10_000,
          [
            debt({
              id: "velky",
              creditor: "Hypotéka — 2,4 mil. Kč jistina",
              amount: 240_000,
              category: "loans",
              dueDate: "2026-06-14",
            }),
            debt({
              id: "maly",
              creditor: "Vodné a stočné — SVJ",
              amount: 4_800,
              category: "utilities",
              dueDate: "2026-06-14",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      const velky = result.recommendations.find((r) => r.debtId === "velky");
      const maly = result.recommendations.find((r) => r.debtId === "maly");

      expect(maly?.recommendedAmount).toBeDefined();
      expect(maly!.recommendedAmount).toBeGreaterThanOrEqual(800);

      const ratio =
        (velky?.recommendedAmount ?? 1) / (maly?.recommendedAmount ?? 1);
      expect(ratio).toBeLessThan(15);
    });

    it("applies minimum payments first for level 0 and 1 debts before lower levels", () => {
      const result = runPriorityEngine(
        profile(
          15_000,
          [
            debt({
              id: "karta",
              creditor: "Visa Classic — ČSOB",
              amount: 6_000,
              category: "credit_card",
              dueDate: "2026-12-01",
            }),
            debt({
              id: "pujcka",
              creditor: "Air Bank — osobní úvěr",
              amount: 18_000,
              category: "loans",
              dueDate: "2026-06-16",
              minimumPayment: 2_500,
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      const pujcka = result.recommendations.find((r) => r.debtId === "pujcka");
      const karta = result.recommendations.find((r) => r.debtId === "karta");

      expect(pujcka?.recommendedAmount).toBeGreaterThanOrEqual(2_500);
      expect(pujcka?.priorityLevel).toBe(1);

      if (karta) {
        expect(pujcka!.recommendedAmount).toBeGreaterThanOrEqual(
          karta.recommendedAmount
        );
      }
    });

    it("allocates partial amount when available funds are below the minimum payment", () => {
      const result = runPriorityEngine(
        profile(
          8_000,
          [
            debt({
              id: "pujcka",
              creditor: "Moneta — splátka úvěru",
              amount: 9_000,
              category: "loans",
              dueDate: "2026-06-14",
              minimumPayment: 9_000,
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      const rec = result.recommendations[0];

      expect(result.lifeBuffer).toBe(1_600);
      expect(result.spendableFunds).toBe(6_400);
      expect(rec?.recommendedAmount).toBe(6_400);
      expect(rec?.recommendedAmount).toBeLessThan(9_000);
      expect(result.totalAllocated).toBe(6_400);
    });
  });

  describe("warnings and edge cases", () => {
    it("returns empty recommendations and Czech warnings when available funds are zero", () => {
      const result = runPriorityEngine(
        profile(
          0,
          [
            debt({
              id: "mobil",
              creditor: "O2 — mobilní tarif",
              amount: 1_990,
              category: "utilities",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      expect(result.recommendations).toHaveLength(0);
      expect(result.totalAllocated).toBe(0);
      expect(result.lifeBuffer).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.summary).toMatch(/volné prostředky/i);
      expect(result.warnings.some((w) => w.includes("věřiteli"))).toBe(true);
    });

    it("warns when multiple critical debts remain unpaid after allocation", () => {
      const result = runPriorityEngine(
        profile(
          5_000,
          [
            debt({
              id: "najem",
              creditor: "Nájem — Olomouc",
              amount: 12_000,
              category: "housing",
              criticalDate: "2026-06-12",
            }),
            debt({
              id: "ele",
              creditor: "E.ON — elektřina",
              amount: 6_500,
              category: "utilities",
              criticalDate: "2026-06-13",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      expect(
        result.warnings.some(
          (w) => w.includes("kritick") && w.includes("věřiteli")
        )
      ).toBe(true);
      expect(
        result.recommendations.filter((r) => r.priorityLevel === 0).length
      ).toBeGreaterThanOrEqual(1);
    });

    it("warns when an execution-risk debt receives less than 50% of its balance", () => {
      const result = runPriorityEngine(
        profile(
          12_000,
          [
            debt({
              id: "exekuce",
              creditor: "Městský úřad — exekuční pokuta",
              amount: 25_000,
              category: "fines",
              dueDate: "2026-06-20",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      const exekuce = result.recommendations.find((r) => r.debtId === "exekuce");

      expect(exekuce?.recommendedAmount).toBeLessThan(12_500);
      expect(result.warnings.some((w) => w.includes("Exekuce"))).toBe(true);
    });
  });

  describe("integration", () => {
    it("handles a mixed scenario with critical, high, medium, and low priority debts", () => {
      const result = runPriorityEngine(
        profile(
          30_000,
          [
            debt({
              id: "najem",
              creditor: "Nájem — Brno střed",
              amount: 13_500,
              category: "housing",
              criticalDate: "2026-06-12",
              criticalNote: "Výpověď",
            }),
            debt({
              id: "ele",
              creditor: "ČEZ — elektřina",
              amount: 3_800,
              category: "utilities",
              dueDate: "2026-06-16",
            }),
            debt({
              id: "zdravotni",
              creditor: "VZP — doplatek",
              amount: 2_400,
              category: "medical",
              dueDate: "2026-07-01",
            }),
            debt({
              id: "karta",
              creditor: "Visa — ČSOB",
              amount: 15_000,
              category: "credit_card",
              dueDate: "2026-12-01",
            }),
          ],
          "stable"
        ),
        "cs",
        TODAY
      );

      const levels = result.recommendations.map((r) => r.priorityLevel);

      expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
      expect(levels[0]).toBe(0);
      expect(result.recommendations[0]?.creditor).toContain("Nájem");
      expect(result.totalAllocated).toBeGreaterThan(0);
      expect(result.totalAllocated).toBeLessThanOrEqual(30_000);
      expect(result.summary).toMatch(/Priorita/i);
      expect(result.lifeBuffer).toBeGreaterThan(0);
    });
  });
});
