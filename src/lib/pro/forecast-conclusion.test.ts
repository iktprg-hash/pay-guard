import { describe, expect, it } from "vitest";
import { buildForecastConclusion } from "@/lib/pro/forecast-conclusion";
import type { ForecastMonth } from "@/lib/pro/cash-flow-forecast";

function month(
  index: number,
  endingBalance: number,
  netChange = 0
): ForecastMonth {
  return {
    index,
    yearMonth: `2026-0${index + 1}`,
    startingBalance: 0,
    income: 0,
    expenses: 0,
    debtPayments: 0,
    netChange,
    endingBalance,
    isDeficit: endingBalance < 0,
  };
}

describe("buildForecastConclusion", () => {
  it("returns projected deficit when a month ends negative", () => {
    const result = buildForecastConclusion(
      [month(0, 5000), month(1, -1200), month(2, -800)],
      -500
    );
    expect(result?.kind).toBe("projected_deficit");
    expect(result?.amount).toBe(1200);
    expect(result?.monthIndex).toBe(1);
  });

  it("returns monthly deficit when net change is negative but balance stays positive", () => {
    const result = buildForecastConclusion(
      [month(0, 3000, -400), month(1, 2600, -400)],
      -400
    );
    expect(result?.kind).toBe("monthly_deficit");
    expect(result?.amount).toBe(400);
  });

  it("returns stable positive when outlook is healthy", () => {
    const result = buildForecastConclusion(
      [month(0, 6000, 500), month(1, 6500, 500), month(2, 7000, 500)],
      500
    );
    expect(result?.kind).toBe("stable_positive");
    expect(result?.amount).toBe(7000);
    expect(result?.monthIndex).toBe(2);
  });
});
