import { describe, expect, it } from "vitest";
import {
  groupByCategoryMonthly,
  projectRecurringByMonth,
} from "./recurring-projection";

describe("recurring-projection", () => {
  it("projects monthly income across 3 months", () => {
    const result = projectRecurringByMonth(
      [
        {
          id: "1",
          amount: 30_000,
          frequency: "monthly",
          nextDate: "2026-06-15",
        },
      ],
      () => "Salary",
      3,
      new Date(2026, 5, 1)
    );

    expect(result).toHaveLength(3);
    expect(result[0].total).toBe(30_000);
    expect(result[1].total).toBe(30_000);
    expect(result[2].total).toBe(30_000);
  });

  it("groups expenses by category monthly equivalent", () => {
    const grouped = groupByCategoryMonthly([
      {
        id: "1",
        category: "housing",
        amount: 15_000,
        frequency: "monthly",
      },
      {
        id: "2",
        category: "food",
        amount: 1_000,
        frequency: "weekly",
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.category).toBe("housing");
    expect(grouped[1]?.category).toBe("food");
  });
});
