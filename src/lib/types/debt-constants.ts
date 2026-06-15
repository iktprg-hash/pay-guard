/** Debt category constants — isolated to avoid circular imports with mergeDebts. */

export const DEBT_CATEGORIES = [
  "housing",
  "utilities",
  "taxes",
  "fines",
  "loans",
  "credit_card",
  "medical",
  "transport",
  "food",
  "subscriptions",
  "other",
] as const;

export type DebtCategory = (typeof DEBT_CATEGORIES)[number];
