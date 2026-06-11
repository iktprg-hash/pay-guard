import type { PaymentRecommendation, PriorityLevel } from "@/lib/types/financial";

const LEVEL_KEYS = ["level0", "level1", "level2", "level3"] as const;

export type RecommendationLevelKey = (typeof LEVEL_KEYS)[number];

/** Normalizuje úroveň priority — starší cache nemusí mít priorityLevel */
export function resolvePriorityLevel(
  rec: PaymentRecommendation & { level?: number }
): PriorityLevel {
  if (
    typeof rec.priorityLevel === "number" &&
    rec.priorityLevel >= 0 &&
    rec.priorityLevel <= 3
  ) {
    return rec.priorityLevel;
  }

  if (typeof rec.level === "number" && rec.level >= 0 && rec.level <= 3) {
    return rec.level as PriorityLevel;
  }

  // Odhad ze skóre priority (vyšší skóre → nižší číslo úrovně)
  if (rec.priority >= 80) return 0;
  if (rec.priority >= 60) return 1;
  if (rec.priority >= 40) return 2;
  return 2;
}

export function priorityLevelMessageKey(
  rec: PaymentRecommendation & { level?: number }
): RecommendationLevelKey {
  return LEVEL_KEYS[resolvePriorityLevel(rec)];
}
