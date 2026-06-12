/**
 * Priority Engine — professional coverage suite
 *
 * Focused Vitest scenarios for buffer modes, level rules, allocation,
 * warnings, locales, and realistic Czech stress cases.
 *
 * Run: npm test -- src/lib/priorityEngine.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  analyzeDebt,
  runPriorityEngine,
  PRIORITY_CONSTANTS,
} from "@/services/priorityEngine";
import type { Debt, FinancialProfile } from "@/lib/types/financial";

const TODAY = new Date("2026-06-11");

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

function rec(result: ReturnType<typeof runPriorityEngine>, id: string) {
  return result.recommendations.find((r) => r.debtId === id);
}

describe("Priority Engine — professional coverage suite", () => {
  describe("life buffer modes", () => {
    it("keeps standard 20% buffer when funds are above the critical threshold", () => {
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
      expect(result.warnings.some((w) => w.includes("Emergency"))).toBe(false);
    });

    it("reduces buffer to 8% with one critical debt and low funds", () => {
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

    it("enters emergency buffer mode with two critical debts and low funds", () => {
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
      expect(result.spendableFunds).toBe(7_360);
      expect(result.warnings.some((w) => w.includes("Emergency"))).toBe(true);
    });
  });

  describe("level 0 classification", () => {
    it("elevates housing, utilities cutoff, and exekuce to level 0", () => {
      const rent = analyzeDebt(
        debt({
          id: "najem",
          creditor: "Stones Residence — nájem",
          amount: 13_000,
          category: "housing",
          criticalDate: "2026-06-13",
          criticalNote: "Výpověď z bytu",
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
          dueDate: "2026-06-20",
        }),
        TODAY
      );

      expect(rent.level).toBe(0);
      expect(utilities.level).toBe(0);
      expect(utilities.factors).toContain("critical_imminent");
      expect(exekuce.level).toBe(0);
      expect(exekuce.factors).toContain("execution_risk");
    });

    it("does not elevate ordinary loans to level 0 even when overdue or due soon", () => {
      const urgentLoan = analyzeDebt(
        debt({
          id: "pujcka",
          creditor: "Air Bank — osobní úvěr",
          amount: 18_000,
          category: "loans",
          dueDate: "2026-06-13",
        }),
        TODAY
      );
      const overdueLoan = analyzeDebt(
        debt({
          id: "moneta",
          creditor: "Moneta Money Bank",
          amount: 9_500,
          category: "loans",
          dueDate: "2026-06-01",
        }),
        TODAY
      );
      const creditCard = analyzeDebt(
        debt({
          id: "karta",
          creditor: "Visa — ČSOB",
          amount: 8_000,
          category: "credit_card",
          dueDate: "2026-06-13",
        }),
        TODAY
      );

      expect(urgentLoan.level).toBe(1);
      expect(overdueLoan.level).toBe(1);
      expect(creditCard.level).toBe(1);
    });
  });

  describe("allocation strategy", () => {
    it("prioritises near-full payment for rent due day after tomorrow", () => {
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
      const ele = rec(result, "ele");

      expect(najem?.priorityLevel).toBe(0);
      expect(najem?.recommendedAmount).toBeGreaterThanOrEqual(7_000);
      expect(najem!.recommendedAmount).toBeGreaterThan(ele?.recommendedAmount ?? 0);
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

      const rent = rec(result, "najem");
      const micro = rec(result, "micro");
      const bank = rec(result, "bank");
      const level1Total =
        (micro?.recommendedAmount ?? 0) + (bank?.recommendedAmount ?? 0);

      expect(rent?.recommendedAmount).toBeGreaterThanOrEqual(7_000);
      expect(micro?.priorityLevel).toBe(1);
      expect(micro!.recommendedAmount).toBeGreaterThan(bank?.recommendedAmount ?? 0);
      expect(micro!.recommendedAmount / level1Total).toBeGreaterThanOrEqual(0.6);
    });

    it("distributes proportionally within level 2 among similar-priority debts", () => {
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
      expect(a?.recommendedAmount).toBeGreaterThan(0);
      expect(b?.recommendedAmount).toBeGreaterThan(0);
      expect(Math.abs(a!.recommendedAmount - b!.recommendedAmount)).toBeLessThan(2_500);
    });

    it("prevents a single large debt from consuming the entire spendable pool", () => {
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

      const hypo = rec(result, "hypo");
      const tel = rec(result, "tel");

      expect(result.spendableFunds).toBe(16_000);
      expect(hypo?.recommendedAmount).toBeGreaterThan(0);
      expect(tel?.recommendedAmount).toBeGreaterThanOrEqual(500);
      expect(hypo!.recommendedAmount).toBeLessThan(result.spendableFunds);
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

      const pujcka = rec(result, "pujcka");

      expect(pujcka?.priorityLevel).toBe(1);
      expect(pujcka?.recommendedAmount).toBeGreaterThanOrEqual(2_800);
    });
  });

  describe("warnings and sanitization", () => {
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
      expect(result.totalAllocated).toBeLessThan(19_500);
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

      expect(rec(result, "exekuce")?.priorityLevel).toBe(0);
      expect(rec(result, "exekuce")?.recommendedAmount).toBeLessThan(12_000);
      expect(result.warnings.some((w) => w.includes("Exekuce"))).toBe(true);
    });

    it("sanitizes NaN, negative, and invalid amounts to safe zero behaviour", () => {
      const result = runPriorityEngine(
        {
          availableFunds: Number.NaN,
          incomeStability: "stable",
          debts: [
            {
              id: "bad",
              creditor: "Neplatný dluh",
              amount: -2_000,
              category: "other",
            },
            {
              id: "nan",
              creditor: "NaN úrok",
              amount: Number.NaN,
              category: "loans",
            },
          ],
        },
        "cs",
        TODAY
      );

      expect(result.lifeBuffer).toBe(0);
      expect(result.spendableFunds).toBe(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.totalAllocated).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("integration and stress scenarios", () => {
    it("handles a full mixed scenario across levels 0, 1, 2, and 3", () => {
      const result = runPriorityEngine(
        profile(35_000, [
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
          debt({
            id: "karta",
            creditor: "Mastercard — UniCredit",
            amount: 12_000,
            category: "credit_card",
            dueDate: "2026-12-15",
          }),
        ]),
        "cs",
        TODAY
      );

      const levels = new Set(result.recommendations.map((r) => r.priorityLevel));

      expect(result.recommendations[0]?.creditor).toContain("Nájem");
      expect(result.recommendations[0]?.priorityLevel).toBe(0);
      expect(levels.has(1)).toBe(true);
      expect(levels.has(2)).toBe(true);
      expect(levels.has(3)).toBe(true);
      expect(result.totalAllocated).toBeGreaterThan(0);
      expect(result.totalAllocated + result.remainingFunds).toBe(35_000);
      expect(result.summary).toMatch(/Priorita/i);
    });

    it("localises summary and warnings correctly in Czech and Russian", () => {
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
      expect(cs.warnings.some((w) => w.includes("Kč") || w.includes("snížena"))).toBe(
        true
      );

      expect(ru.summary).toMatch(/Приоритет|₽|RUB/i);
      expect(
        ru.warnings.some(
          (w) =>
            w.includes("₽") ||
            w.includes("RUB") ||
            w.includes("снижен") ||
            w.includes("Emergency")
        )
      ).toBe(true);
    });

    it("survives very low funds with multiple urgent debts in emergency mode", () => {
      const result = runPriorityEngine(
        profile(5_000, [
          debt({
            id: "najem",
            creditor: "Nájem — Libeň",
            amount: 9_500,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
          debt({
            id: "ele",
            creditor: "PRE — elektřina",
            amount: 4_200,
            category: "utilities",
            criticalDate: "2026-06-13",
          }),
          debt({
            id: "micro",
            creditor: "Rychlá půjčka online",
            amount: 3_500,
            category: "loans",
            interestRate: 38,
            dueDate: "2026-06-15",
          }),
        ]),
        "cs",
        TODAY
      );

      const najem = rec(result, "najem");

      expect(result.lifeBufferPercent).toBe(PRIORITY_CONSTANTS.BUFFER_EMERGENCY_STABLE);
      expect(result.lifeBuffer).toBe(400);
      expect(result.totalAllocated).toBeLessThanOrEqual(5_000);
      expect(result.totalAllocated + result.remainingFunds).toBe(5_000);
      expect(result.warnings.some((w) => w.includes("Emergency"))).toBe(true);
      expect(najem?.priorityLevel).toBe(0);
      expect(najem?.recommendedAmount).toBeGreaterThan(0);
      expect(najem!.recommendedAmount).toBeGreaterThan(
        rec(result, "micro")?.recommendedAmount ?? 0
      );
    });
  });
});
