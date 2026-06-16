import type { IncomeStability } from "@/lib/types/financial";

type StabilityTranslator = (
  key: "stabilityStable" | "stabilityVariable" | "stabilityUncertain"
) => string;

/** Localized label for an income stability enum value. */
export function formatIncomeStabilityLabel(
  stability: IncomeStability | undefined,
  t: StabilityTranslator
): string {
  if (!stability) return "—";
  switch (stability) {
    case "stable":
      return t("stabilityStable");
    case "variable":
      return t("stabilityVariable");
    case "uncertain":
      return t("stabilityUncertain");
    default:
      return "—";
  }
}

/** Shows effective stability downgrade, e.g. Stable → Variable. */
export function formatIncomeStabilityDisplay(
  stored: IncomeStability | undefined,
  effective: IncomeStability | undefined,
  t: StabilityTranslator
): string {
  if (effective && stored && effective !== stored) {
    return `${formatIncomeStabilityLabel(stored, t)} → ${formatIncomeStabilityLabel(effective, t)}`;
  }
  return formatIncomeStabilityLabel(stored ?? effective, t);
}
