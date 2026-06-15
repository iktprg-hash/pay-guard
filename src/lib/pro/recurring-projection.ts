import type { Frequency } from "@/lib/types/financial";
import { amountToMonthlyEquivalent } from "@/lib/financial/recurring-utils";

export const DEFAULT_PROJECTION_MONTHS = 3;

export interface RecurringItemProjection {
  id: string;
  label: string;
  amount: number;
}

export interface MonthCashProjection {
  index: number;
  yearMonth: string;
  total: number;
  items: RecurringItemProjection[];
}

export interface CategoryTotal {
  category: string;
  monthlyEquivalent: number;
  itemCount: number;
}

interface RecurringProjectable {
  id: string;
  amount: number;
  frequency: Frequency;
  nextDate: string;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function yearMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRange(now: Date, offset: number) {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end, yearMonth: yearMonthKey(start) };
}

function advanceByFrequency(date: Date, frequency: Frequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "one_time":
      next.setFullYear(9999);
      break;
  }
  return next;
}

/** Project scheduled occurrences over the next N calendar months. */
export function projectRecurringByMonth<T extends RecurringProjectable>(
  items: T[],
  getLabel: (item: T) => string,
  monthCount: number = DEFAULT_PROJECTION_MONTHS,
  now: Date = new Date()
): MonthCashProjection[] {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const { start, end, yearMonth } = monthRange(now, index);
    return { index, yearMonth, start, end, total: 0, items: [] as RecurringItemProjection[] };
  });

  const horizonEnd = months[months.length - 1]?.end;
  if (!horizonEnd) return [];

  for (const item of items) {
    let cursor = parseDateOnly(item.nextDate);

    while (cursor <= horizonEnd) {
      for (const month of months) {
        if (cursor >= month.start && cursor <= month.end) {
          month.total += item.amount;
          month.items.push({
            id: item.id,
            label: getLabel(item),
            amount: item.amount,
          });
        }
      }

      if (item.frequency === "one_time") break;
      cursor = advanceByFrequency(cursor, item.frequency);
    }
  }

  return months.map(({ index, yearMonth, total, items: monthItems }) => ({
    index,
    yearMonth,
    total,
    items: monthItems,
  }));
}

/** Sum monthly-equivalent amounts grouped by category. */
export function groupByCategoryMonthly<T extends { category: string; amount: number; frequency: Frequency }>(
  items: T[]
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();

  for (const item of items) {
    const monthly = amountToMonthlyEquivalent(item.amount, item.frequency);
    const existing = map.get(item.category);
    if (existing) {
      existing.monthlyEquivalent += monthly;
      existing.itemCount += 1;
    } else {
      map.set(item.category, {
        category: item.category,
        monthlyEquivalent: monthly,
        itemCount: 1,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => b.monthlyEquivalent - a.monthlyEquivalent
  );
}

export function sumMonthlyEquivalent<T extends { amount: number; frequency: Frequency }>(
  items: T[]
): number {
  return items.reduce(
    (sum, item) => sum + amountToMonthlyEquivalent(item.amount, item.frequency),
    0
  );
}

export function sumProjectionTotal(months: MonthCashProjection[]): number {
  return months.reduce((sum, m) => sum + m.total, 0);
}
