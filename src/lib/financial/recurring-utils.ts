import type { Frequency } from "@/lib/types/financial";

/** Convert recurring amount to an approximate monthly equivalent. */
export function amountToMonthlyEquivalent(
  amount: number,
  frequency: Frequency
): number {
  switch (frequency) {
    case "monthly":
      return amount;
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "one_time":
      return 0;
    default:
      return amount;
  }
}
