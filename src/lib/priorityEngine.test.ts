/**
 * Priority Engine — consolidated coverage suite
 *
 * Single source of focused Vitest scenarios. Complements
 * src/services/priorityEngine.test.ts with readable, maintainable cases.
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

// Fixed reference date — keeps deadline math deterministic across runs.
const TODAY = new Date("2026-06-11");

// ─── Test helpers ────────────────────────────────────────────────────────────

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

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Priority Engine", () => {
  describe("life buffer", () => {
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
  });

  describe("priority levels", () => {
    it("assigns level 0 only to essential services and execution-risk debts", () => {
      expect(
        analyzeDebt(
          debt({
            id: "najem",
            creditor: "Stones Residence — nájem",
            amount: 13_000,
            category: "housing",
            criticalDate: "2026-06-13",
          }),
          TODAY
        ).level
      ).toBe(0);

      expect(
        analyzeDebt(
          debt({
            id: "plyn",
            creditor: "Pražská plynárenská",
            amount: 5_200,
            category: "utilities",
            criticalDate: "2026-06-13",
            criticalNote: "Hrozí odpojení plynu",
          }),
          TODAY
        ).level
      ).toBe(0);

      expect(
        analyzeDebt(
          debt({
            id: "ex",
            creditor: "Městský úřad — exekuční pokuta",
            amount: 18_000,
            category: "fines",
          }),
          TODAY
        ).level
      ).toBe(0);

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
      expect(micro?.priorityLevel).toBe(1);
      expect(micro!.recommendedAmount).toBeGreaterThan(bank?.recommendedAmount ?? 0);
      expect(micro!.recommendedAmount / level1Total).toBeGreaterThanOrEqual(0.6);
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
      expect(a?.recommendedAmount).toBeGreaterThan(0);
      expect(b?.recommendedAmount).toBeGreaterThan(0);
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

      expect(result.spendableFunds).toBe(16_000);
      expect(rec(result, "hypo")?.recommendedAmount).toBeLessThan(16_000);
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

      expect(rec(result, "pujcka")?.priorityLevel).toBe(1);
      expect(rec(result, "pujcka")?.recommendedAmount).toBeGreaterThanOrEqual(2_800);
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
      expect(result.totalAllocated).toBeLessThan(19_500);
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

      expect(result.lifeBuffer).toBe(0);
      expect(result.spendableFunds).toBe(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.totalAllocated).toBe(0);
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

      expect(result.lifeBuffer).toBe(0);
      expect(result.spendableFunds).toBe(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.totalAllocated).toBe(0);
      expect(result.warnings.some((w) => w.includes("volné prostředky"))).toBe(true);
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

      expect(result.recommendations[0]?.creditor).toContain("Nájem");
      expect(result.recommendations[0]?.priorityLevel).toBe(0);
      expect(levels.has(1)).toBe(true);
      expect(levels.has(2)).toBe(true);
      expect(result.totalAllocated).toBeGreaterThan(0);
      expect(result.totalAllocated + result.remainingFunds).toBe(28_000);
      expect(result.summary).toMatch(/Priorita/i);
    });
  });
});
