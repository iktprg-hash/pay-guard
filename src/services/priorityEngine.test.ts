/**
 * Testy Priority Engine
 * Spuštění: npm test
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
} from "./priorityEngine";
import type { Debt, FinancialProfile } from "@/lib/types/financial";

const TODAY = new Date("2026-06-11");

function debt(overrides: Partial<Debt> & Pick<Debt, "id" | "creditor" | "amount">): Debt {
  return { category: "other", ...overrides };
}

function profile(
  funds: number,
  debts: Debt[],
  stability?: FinancialProfile["incomeStability"]
): FinancialProfile {
  return { availableFunds: funds, incomeStability: stability, debts };
}

describe("calculateLifeBufferPercent", () => {
  it("stable → 20 %", () => {
    expect(calculateLifeBufferPercent("stable")).toBe(0.2);
  });

  it("variable → 28 %", () => {
    expect(calculateLifeBufferPercent("variable")).toBe(0.28);
  });

  it("uncertain → 35 %", () => {
    expect(calculateLifeBufferPercent("uncertain")).toBe(0.35);
  });

  it("neznámé → 25 %", () => {
    expect(calculateLifeBufferPercent(undefined)).toBe(0.25);
  });
});

describe("analyzeDebt — úrovně priority", () => {
  it("kritický termín za 2 dny → úroveň 0", () => {
    const a = analyzeDebt(
      debt({
        id: "1",
        creditor: "Nájem",
        amount: 15000,
        category: "housing",
        criticalDate: "2026-06-13",
        criticalNote: "Vystěhování",
      }),
      TODAY
    );
    expect(a.level).toBe(0);
    expect(a.urgencyScore).toBeGreaterThan(100);
  });

  it("nájem po splatnosti → úroveň 0", () => {
    const a = analyzeDebt(
      debt({
        id: "2",
        creditor: "Nájem",
        amount: 10000,
        category: "housing",
        dueDate: "2026-06-01",
      }),
      TODAY
    );
    expect(a.level).toBe(0);
  });

  it("splatnost za 5 dní → úroveň 1", () => {
    const a = analyzeDebt(
      debt({
        id: "3",
        creditor: "Elektřina",
        amount: 3000,
        category: "utilities",
        dueDate: "2026-06-16",
      }),
      TODAY
    );
    expect(a.level).toBe(1);
  });

  it("splatnost za 20 dní → úroveň 2", () => {
    const a = analyzeDebt(
      debt({
        id: "4",
        creditor: "Půjčka",
        amount: 5000,
        category: "loans",
        dueDate: "2026-07-01",
      }),
      TODAY
    );
    expect(a.level).toBe(2);
  });

  it("kreditní karta bez data → úroveň 3", () => {
    const a = analyzeDebt(
      debt({
        id: "5",
        creditor: "Visa",
        amount: 8000,
        category: "credit_card",
      }),
      TODAY
    );
    expect(a.level).toBe(3);
  });

  it("kreditní karta se splatností za 2 dny → úroveň 1 (ne 0)", () => {
    const a = analyzeDebt(
      debt({
        id: "5b",
        creditor: "Visa",
        amount: 8000,
        category: "credit_card",
        dueDate: "2026-06-13",
      }),
      TODAY
    );
    expect(a.level).toBe(1);
    expect(a.urgencyScore).toBeGreaterThanOrEqual(0);
  });

  it("půjčka po splatnosti → úroveň 1 (ne 0 bez esenciální kategorie)", () => {
    const a = analyzeDebt(
      debt({
        id: "5c",
        creditor: "Bank",
        amount: 12000,
        category: "loans",
        dueDate: "2026-06-01",
      }),
      TODAY
    );
    expect(a.level).toBe(1);
  });
});

describe("edge cases — exekuce a více termínů", () => {
  it("detekuje exekuci z poznámky", () => {
    expect(
      isExecutionRisk(
        debt({
          id: "e",
          creditor: "Exekutor",
          amount: 5000,
          criticalNote: "Soudní exekuce na účet",
        })
      )
    ).toBe(true);
  });

  it("kategorie fines a taxes jsou vždy execution risk", () => {
    expect(
      isExecutionRisk(
        debt({ id: "f", creditor: "Úřad", amount: 2000, category: "fines" })
      )
    ).toBe(true);
    expect(
      isExecutionRisk(
        debt({ id: "t", creditor: "Finanční úřad", amount: 3000, category: "taxes" })
      )
    ).toBe(true);
  });

  it("detekuje ФССП / приставов z poznámky (RU)", () => {
    expect(
      isExecutionRisk(
        debt({
          id: "fssp",
          creditor: "ФССП",
          amount: 15000,
          criticalNote: "Арест счёта судебным приставом",
        })
      )
    ).toBe(true);
  });

  it("exekuce → úroveň 0 a nejvyšší priorita", () => {
    const result = runPriorityEngine(
      profile(
        3000,
        [
          debt({
            id: "exec",
            creditor: "Exekutor Města",
            amount: 8000,
            category: "fines",
            criticalNote: "Exekuce",
            criticalDate: "2026-06-20",
          }),
          debt({
            id: "card",
            creditor: "Visa",
            amount: 3000,
            category: "credit_card",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    expect(result.recommendations[0].creditor).toBe("Exekutor Města");
    expect(result.recommendations[0].priorityLevel).toBe(0);
    expect(result.recommendations[0].explanation).toMatch(/exeku/i);
    expect(result.warnings.some((w) => w.includes("Exekuce") || w.includes("exeku"))).toBe(
      true
    );
  });

  it("více termínů — bere nejbližší", () => {
    expect(hasMultipleDeadlines(10, 5)).toBe(true);
    expect(nearestDeadlineDays(10, 5)).toBe(5);
    expect(nearestDeadlineDays(3, 14)).toBe(3);
  });

  it("více kritických dluhů → varování", () => {
    const result = runPriorityEngine(
      profile(
        3000,
        [
          debt({
            id: "a",
            creditor: "Nájem",
            amount: 15000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
          debt({
            id: "b",
            creditor: "Elektřina",
            amount: 5000,
            category: "utilities",
            criticalDate: "2026-06-13",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    expect(result.warnings.some((w) => w.includes("kritick"))).toBe(true);
  });
});

describe("daysBetween", () => {
  it("počítá dny dopředu", () => {
    expect(daysBetween(TODAY, new Date("2026-06-14"))).toBe(3);
  });
});

describe("resolveLifeBufferPercent", () => {
  it("sníží buffer při kritickém dluhu a nízkých prostředcích", () => {
    expect(
      resolveLifeBufferPercent("stable", {
        hasLevel0Debt: true,
        availableFunds: 10_000,
      })
    ).toBe(PRIORITY_CONSTANTS.BUFFER_CRITICAL_LOW_STABLE);
  });

  it("zachová standardní buffer bez kritických dluhů", () => {
    expect(
      resolveLifeBufferPercent("stable", {
        hasLevel0Debt: false,
        availableFunds: 10_000,
      })
    ).toBe(0.2);
  });

  it("zachová standardní buffer i s kritickým dluhem při vyšších prostředcích", () => {
    expect(
      resolveLifeBufferPercent("stable", {
        hasLevel0Debt: true,
        availableFunds: 20_000,
      })
    ).toBe(0.2);
  });
});

describe("runPriorityEngine — dynamický buffer a sanitizace", () => {
  it("sníží buffer na 8 % při kritickém dluhu a 10 000 Kč", () => {
    const result = runPriorityEngine(
      profile(
        10_000,
        [
          debt({
            id: "rent",
            creditor: "Nájem",
            amount: 15_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    expect(result.lifeBufferPercent).toBe(0.08);
    expect(result.lifeBuffer).toBe(800);
    expect(result.warnings.some((w) => w.includes("snížena") || w.includes("8"))).toBe(
      true
    );
  });

  it("sanitizuje NaN a záporné částky", () => {
    const result = runPriorityEngine(
      {
        availableFunds: Number.NaN,
        debts: [
          {
            id: "1",
            creditor: "Test",
            amount: -500,
            category: "other",
          },
        ],
      },
      "cs",
      TODAY
    );

    expect(result.recommendations).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("runPriorityEngine", () => {
  it("rezervuje 20 % buffer při stabilním příjmu", () => {
    const result = runPriorityEngine(
      profile(
        10000,
        [
          debt({
            id: "r",
            creditor: "Nájem",
            amount: 15000,
            category: "housing",
            dueDate: "2026-06-15",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    expect(result.lifeBuffer).toBe(2000);
    expect(result.lifeBufferPercent).toBe(0.2);
    expect(result.spendableFunds).toBe(8000);
    expect(result.warnings.some((w) => w.includes("Rezerva"))).toBe(true);
  });

  it("rezervuje 35 % buffer při nejistém příjmu", () => {
    const result = runPriorityEngine(
      profile(
        10000,
        [debt({ id: "x", creditor: "Test", amount: 1000, category: "other" })],
        "uncertain"
      ),
      "cs",
      TODAY
    );

    expect(result.lifeBuffer).toBe(3500);
    expect(result.spendableFunds).toBe(6500);
  });

  it("kritický dluh dostane vyšší prioritu než kreditní karta", () => {
    const result = runPriorityEngine(
      profile(
        10000,
        [
          debt({
            id: "card",
            creditor: "Visa",
            amount: 5000,
            category: "credit_card",
            dueDate: "2026-12-01",
          }),
          debt({
            id: "rent",
            creditor: "Nájem",
            amount: 15000,
            category: "housing",
            criticalDate: "2026-06-13",
            criticalNote: "Vystěhování",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(result.recommendations[0].creditor).toBe("Nájem");
    expect(result.recommendations[0].priorityLevel).toBe(0);
  });

  it("alokuje většinu prostředků na dražší dluh úrovně 1", () => {
    const result = runPriorityEngine(
      profile(
        10000,
        [
          debt({
            id: "micro",
            creditor: "Rychlá půjčka online",
            amount: 5000,
            category: "loans",
            interestRate: 35,
            dueDate: "2026-06-17",
          }),
          debt({
            id: "bank",
            creditor: "Air Bank — úvěr",
            amount: 4000,
            category: "loans",
            interestRate: 8,
            dueDate: "2026-06-18",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    const micro = result.recommendations.find((r) => r.debtId === "micro");
    const bank = result.recommendations.find((r) => r.debtId === "bank");
    const total = result.recommendations.reduce(
      (s, r) => s + r.recommendedAmount,
      0
    );

    expect(total).toBeLessThanOrEqual(8000);
    expect(micro?.recommendedAmount).toBeGreaterThan(0);
    expect(micro!.recommendedAmount).toBeGreaterThan(bank?.recommendedAmount ?? 0);
    expect(micro!.recommendedAmount / total).toBeGreaterThanOrEqual(0.6);
  });

  it("nepřekročí disponibilní prostředky", () => {
    const result = runPriorityEngine(
      profile(
        5000,
        [
          debt({
            id: "1",
            creditor: "A",
            amount: 10000,
            category: "housing",
            dueDate: "2026-06-12",
          }),
          debt({
            id: "2",
            creditor: "B",
            amount: 10000,
            category: "utilities",
            dueDate: "2026-06-13",
          }),
          debt({
            id: "3",
            creditor: "C",
            amount: 10000,
            category: "loans",
            dueDate: "2026-06-20",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    expect(result.totalAllocated).toBeLessThanOrEqual(5000);
    expect(result.remainingFunds + result.totalAllocated).toBe(5000);
  });

  it("prázdný seznam dluhů", () => {
    const result = runPriorityEngine(profile(5000, []), "cs", TODAY);
    expect(result.recommendations).toHaveLength(0);
    expect(result.summary).toMatch(/dluhy|долг|debts/i);
  });

  it("nulové prostředky → varování", () => {
    const result = runPriorityEngine(
      profile(0, [debt({ id: "1", creditor: "A", amount: 1000, category: "other" })]),
      "cs",
      TODAY
    );
    expect(result.recommendations).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("ru locale — summary a varování v rublech", () => {
    const result = runPriorityEngine(
      profile(
        10000,
        [
          debt({
            id: "rent",
            creditor: "Аренда",
            amount: 25000,
            category: "housing",
            dueDate: "2026-06-10",
            minimumPayment: 15000,
          }),
        ],
        "stable"
      ),
      "ru",
      TODAY
    );
    expect(result.summary).toMatch(/₽|RUB/);
    expect(result.warnings.some((w) => w.includes("₽") || w.includes("RUB"))).toBe(
      true
    );
  });

  it("každé doporučení má explanation a priorityLevel", () => {
    const result = runPriorityEngine(
      profile(
        20000,
        [
          debt({
            id: "1",
            creditor: "Nájem",
            amount: 12000,
            category: "housing",
            dueDate: "2026-06-18",
            minimumPayment: 12000,
          }),
        ],
        "variable"
      ),
      "cs",
      TODAY
    );

    for (const rec of result.recommendations) {
      expect(rec.priorityLevel).toBeGreaterThanOrEqual(0);
      expect(rec.priorityLevel).toBeLessThanOrEqual(3);
      expect(rec.explanation.length).toBeGreaterThan(0);
      expect(rec.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("Priority Engine — additional CZ scenarios", () => {
  it("assigns level 0 to utilities with imminent critical disconnection deadline", () => {
    const analysis = analyzeDebt(
      debt({
        id: "plyn",
        creditor: "Pražská plynárenská",
        amount: 5200,
        category: "utilities",
        criticalDate: "2026-06-13",
        criticalNote: "Hrozí odpojení plynu",
      }),
      TODAY
    );

    expect(analysis.level).toBe(0);
    expect(analysis.factors).toContain("critical_imminent");
  });

  it("applies minimum payments first for level 1 debts before lower levels", () => {
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
    expect(pujcka?.recommendedAmount).toBeGreaterThanOrEqual(2_500);
    expect(pujcka?.priorityLevel).toBe(1);
  });

  it("allocates partial amount when funds are below minimum payment", () => {
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

    expect(result.spendableFunds).toBe(6_400);
    expect(result.recommendations[0]?.recommendedAmount).toBe(6_400);
  });

  it("warns when execution-risk debt receives less than 50% payment", () => {
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

    expect(result.recommendations[0]?.recommendedAmount).toBeLessThan(12_500);
    expect(result.warnings.some((w) => w.includes("Exekuce"))).toBe(true);
  });

  it("handles mixed critical, high, medium, and low priority debts", () => {
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
          }),
          debt({
            id: "ele",
            creditor: "ČEZ — elektřina",
            amount: 3_800,
            category: "utilities",
            dueDate: "2026-06-16",
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

    expect(result.recommendations[0]?.priorityLevel).toBe(0);
    expect(result.recommendations[0]?.creditor).toContain("Nájem");
    expect(result.totalAllocated).toBeGreaterThan(0);
    expect(result.summary).toMatch(/Priorita/i);
  });

  it("prioritises the most urgent level-0 debt over less urgent critical debts", () => {
    const result = runPriorityEngine(
      profile(
        10_000,
        [
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
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    const najem = result.recommendations.find((r) => r.debtId === "najem");
    const ele = result.recommendations.find((r) => r.debtId === "ele");

    expect(najem?.recommendedAmount).toBeGreaterThan(0);
    expect(najem!.recommendedAmount).toBeGreaterThan(ele?.recommendedAmount ?? 0);
    expect(najem!.recommendedAmount).toBeGreaterThanOrEqual(8_400);
  });

  it("uses emergency buffer when multiple level-0 debts exist with low funds", () => {
    const result = runPriorityEngine(
      profile(
        8_000,
        [
          debt({
            id: "najem",
            creditor: "Nájem",
            amount: 10_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
          debt({
            id: "exekuce",
            creditor: "Exekuce",
            amount: 6_000,
            category: "fines",
            dueDate: "2026-06-13",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    expect(result.lifeBufferPercent).toBe(0.08);
    expect(result.lifeBuffer).toBe(640);
    expect(result.warnings.some((w) => w.includes("Emergency"))).toBe(true);
  });

  it("prioritises expensive level-1 debt after level-0 critical debts are covered", () => {
    const result = runPriorityEngine(
      profile(
        15_000,
        [
          debt({
            id: "rent",
            creditor: "Nájem",
            amount: 8_000,
            category: "housing",
            criticalDate: "2026-06-12",
          }),
          debt({
            id: "micro",
            creditor: "SMS půjčka",
            amount: 4_000,
            category: "loans",
            interestRate: 40,
            dueDate: "2026-06-17",
          }),
          debt({
            id: "bank",
            creditor: "Moneta — úvěr",
            amount: 3_000,
            category: "loans",
            interestRate: 9,
            dueDate: "2026-06-18",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    const rent = result.recommendations.find((r) => r.debtId === "rent");
    const micro = result.recommendations.find((r) => r.debtId === "micro");
    const bank = result.recommendations.find((r) => r.debtId === "bank");

    expect(rent?.recommendedAmount).toBeGreaterThanOrEqual(7_000);
    expect(micro?.recommendedAmount).toBeGreaterThan(0);
    expect(micro!.recommendedAmount).toBeGreaterThan(bank?.recommendedAmount ?? 0);
  });
});
