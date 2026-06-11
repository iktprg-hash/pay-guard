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
  it("sníží buffer na 10 % při kritickém dluhu a 10 000 Kč", () => {
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

    expect(result.lifeBufferPercent).toBe(0.1);
    expect(result.lifeBuffer).toBe(1000);
    expect(result.warnings.some((w) => w.includes("snížena") || w.includes("10"))).toBe(
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

  it("proporcionálně rozdělí peníze mezi dva dluhy úrovně 1", () => {
    const result = runPriorityEngine(
      profile(
        10000,
        [
          debt({
            id: "a",
            creditor: "Elektřina",
            amount: 4000,
            category: "utilities",
            dueDate: "2026-06-14",
          }),
          debt({
            id: "b",
            creditor: "Plyn",
            amount: 3000,
            category: "utilities",
            dueDate: "2026-06-15",
          }),
        ],
        "stable"
      ),
      "cs",
      TODAY
    );

    const total = result.recommendations.reduce(
      (s, r) => s + r.recommendedAmount,
      0
    );
    expect(total).toBeLessThanOrEqual(8000);
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations.every((r) => r.explanation.length > 10)).toBe(
      true
    );
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
