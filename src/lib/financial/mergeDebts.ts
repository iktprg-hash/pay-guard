import type { Debt, DebtCategory } from "@/lib/types/financial";

const VALID_CATEGORIES: DebtCategory[] = [
  "housing",
  "utilities",
  "taxes",
  "fines",
  "loans",
  "credit_card",
  "medical",
  "other",
];

function slugCreditor(creditor: string): string {
  return creditor.slice(0, 12).replace(/\s/g, "-").toLowerCase();
}

function stableDebtId(creditor: string, index: number): string {
  return `debt-${index}-${slugCreditor(creditor)}`;
}

/** Validuje a normalizuje kategorii dluhu */
export function normalizeCategory(cat: string): DebtCategory {
  return VALID_CATEGORIES.includes(cat as DebtCategory)
    ? (cat as DebtCategory)
    : "other";
}

/**
 * Sloučí seznam dluhů — nové aktualizují existující podle věřitele,
 * ne nahrazují celý seznam (fix audit bug).
 */
export function mergeDebts(current: Debt[], incoming: Debt[]): Debt[] {
  const merged = [...current];

  for (let i = 0; i < incoming.length; i++) {
    const debt = incoming[i];
    const creditorKey = debt.creditor.trim().toLowerCase();

    const existingIdx = merged.findIndex(
      (d) =>
        d.id === debt.id ||
        d.creditor.trim().toLowerCase() === creditorKey
    );

    if (existingIdx >= 0) {
      merged[existingIdx] = {
        ...merged[existingIdx],
        ...debt,
        id: merged[existingIdx].id,
        creditor: debt.creditor || merged[existingIdx].creditor,
      };
    } else {
      merged.push({
        ...debt,
        id: debt.id || stableDebtId(debt.creditor, merged.length),
      });
    }
  }

  return merged;
}
