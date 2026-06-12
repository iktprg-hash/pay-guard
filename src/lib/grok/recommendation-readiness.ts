import { analyzeDebt } from "@/services/priorityEngine";
import type { FinancialProfile } from "@/lib/types/financial";

/** quick = minimum data; full = user wants detailed long-term plan */
export type AnalysisMode = "gathering" | "quick" | "full";

export interface ReadinessAssessment {
  mode: AnalysisMode;
  canRecommend: boolean;
  hasCriticalDebt: boolean;
  shouldAskIncome: boolean;
  shouldAutoDeliver: boolean;
}

const FULL_PLAN_PATTERN =
  /detail|podrobn|полн|všechny|vsechny|long.?term|dlouhodob|долгосроч|all debts|complete plan|kompletn|kompletní|точн|подробн|every debt|všech/i;

const UNSTABLE_INCOME_PATTERN =
  /nestabil|kolís|kolisa|variable|uncertain|neist|неустой|нестабил|фриланс|freelance|irregular|нерегуляр|плавающ|samostatn/i;

function debtIsActionable(
  debt: FinancialProfile["debts"][number]
): boolean {
  return Boolean(debt.creditor?.trim()) && debt.amount > 0;
}

/** At least one debt is Priority Engine level 0. */
export function profileHasCriticalDebt(
  profile: FinancialProfile,
  today: Date = new Date()
): boolean {
  return profile.debts.some(
    (debt) => debtIsActionable(debt) && analyzeDebt(debt, today).level === 0
  );
}

export function userWantsFullAnalysis(text: string): boolean {
  return FULL_PLAN_PATTERN.test(text);
}

export function userMentionedUnstableIncome(text: string): boolean {
  return UNSTABLE_INCOME_PATTERN.test(text);
}

/**
 * Minimum to run Priority Engine:
 * - availableFunds > 0
 * - at least one debt with creditor + amount
 */
export function hasMinimumRecommendationData(profile: FinancialProfile): boolean {
  return (
    profile.availableFunds > 0 &&
    profile.debts.some(debtIsActionable)
  );
}

/**
 * Assess whether Grok should deliver a recommendation now and in which mode.
 */
export function assessRecommendationReadiness(
  profile: FinancialProfile,
  options?: {
    lastUserMessage?: string;
    today?: Date;
  }
): ReadinessAssessment {
  const lastUserMessage = options?.lastUserMessage ?? "";
  const today = options?.today ?? new Date();
  const hasCritical = profileHasCriticalDebt(profile, today);
  const hasMinimum = hasMinimumRecommendationData(profile);
  const wantsFull = userWantsFullAnalysis(lastUserMessage);
  const unstableIncome = userMentionedUnstableIncome(lastUserMessage);

  const shouldAskIncome =
    wantsFull || (unstableIncome && !profile.monthlyIncome && !profile.incomeStability);

  if (!hasMinimum) {
    return {
      mode: "gathering",
      canRecommend: false,
      hasCriticalDebt: hasCritical,
      shouldAskIncome: shouldAskIncome,
      shouldAutoDeliver: false,
    };
  }

  if (wantsFull && shouldAskIncome) {
    return {
      mode: "gathering",
      canRecommend: false,
      hasCriticalDebt: hasCritical,
      shouldAskIncome: true,
      shouldAutoDeliver: false,
    };
  }

  const mode: AnalysisMode = wantsFull || profile.debts.length >= 3 ? "full" : "quick";

  return {
    mode,
    canRecommend: true,
    hasCriticalDebt: hasCritical,
    shouldAskIncome,
    shouldAutoDeliver: hasCritical || mode === "quick",
  };
}
