/**
 * Pay Guard — Priority Engine
 * =============================================================================
 *
 * Deterministický algoritmus prioritizace plateb (bez AI, bez side-effectů).
 *
 * @module services/priorityEngine
 * @version production — 2026-06-11
 *
 * ## Chování (shrnutí)
 *
 * | Úroveň | Význam   | Typické spouštěče                                    |
 * |--------|----------|------------------------------------------------------|
 * | 0      | Kritický | Exekuce, esenciál po splatnosti, blízký krit. termín |
 * | 1      | Vysoký   | Splatnost ≤7 dní, prodlení u běžných dluhů           |
 * | 2      | Střední  | Splatnost ≤30 dní, esenciál bez data                 |
 * | 3      | Nízký    | Ostatní                                              |
 *
 * Life buffer: 20–35 % (standard) nebo 8–10 % při kritickém dluhu a
 * `availableFunds < 15 000` (emergency režim při ≥2 dluzích úrovně 0).
 * Alokace: min. splátky (0–1) → level 0 dle termínu → level 1 dle ceny peněz
 * (70–90 % mikropůjčky, 50–70 % běžné úvěry) → proporcionálně 2→3.
 *
 * ## Historie vylepšení
 *
 * - **2026-06** — úroveň 0 jen pro esenciální/exekuční termíny; dynamický buffer;
 *   cap alokace 50 000 Kč; fines/taxes = execution risk; sanitizace vstupu.
 * - **2026-06-11 (finální polish)** — `as const satisfies` konstanty; jeden průchod
 *   pro varování; mapa stavů místo opakovaného `find`; DRY buffer procenta;
 *   rozšířená JSDoc; bez redundantní sanitizace v alokaci.
 * - **2026-06-11 (finální optimalizace)** — `levelPools` se počítají přímo při
 *   alokaci (bez druhého průchodu); zjednodušené `msgSummary`; export typu
 *   `PriorityConstants`.
 * - **2026-06-12 (level-0 rozhodnost)** — prioritní alokace u úrovně 0 dle
 *   nejbližšího termínu; 70–100 % u ultra-urgent (≤5 dní); buffer 8–12 %
 *   v emergency režimu (≥2 kritické dluhy + nízké prostředky).
 * - **2026-06-12 (level-1 rozhodnost)** — po úrovni 0 směřuje 60–80 % poolu
 *   na nejdražší dluh (úrok + prodlení + mikropůjčky); greedy dle ceny peněz.
 * - **2026-06-12 (level-1 mikropůjčky)** — 70–90 % poolu u mikropůjček (>30 %
 *   nebo SMS/rychlá půjčka); 50–70 % u běžných úvěrů; emergency buffer max 10 %.
 * - **2026-06-15 (Pro cash flow)** — recurring incomes/expenses, effective stability,
 *   expense-based buffer floor, deficit spendable guard, 2-month forecast warnings.
 * - **2026-06-16 (Pro planning)** — planning available funds from recurring streams;
 *   cash-flow buffer floor 20–30%; analyzeDebt cash-flow stress; short-term forecast.
 *
 * ## Exportované API
 *
 * `runPriorityEngine`, `analyzeDebt`, `buildExplanation`, `isExecutionRisk`,
 * `calculateLifeBufferPercent`, `resolveLifeBufferPercent`, `daysBetween`,
 * `nearestDeadlineDays`, `hasMultipleDeadlines`, `PRIORITY_CONSTANTS`
 * Pro: pass `recurringIncomes` / `recurringExpenses` on {@link FinancialProfile}.
 */

import {
  formatMoney,
  roundMoney,
} from "@/lib/financial/locale-config";
import {
  buildProEngineCashFlowContext,
  type ProEngineCashFlowContext,
} from "@/lib/pro/pro-engine-cashflow";
import type {
  Debt,
  DebtCategory,
  FinancialProfile,
  IncomeStability,
  PaymentRecommendation,
  PriorityLevel,
  PrioritizationResult,
} from "@/lib/types/financial";

export type Locale = "cs" | "ru" | "en";

// ─── Konstanty ───────────────────────────────────────────────────────────────

type PriorityConstantsShape = {
  readonly CATEGORY_WEIGHT: Record<DebtCategory, number>;
  readonly LEVEL_WEIGHT: Record<PriorityLevel, number>;
  readonly ESSENTIAL_CATEGORIES: readonly DebtCategory[];
  readonly AUTO_EXECUTION_CATEGORIES: readonly DebtCategory[];
  readonly EXECUTION_KEYWORDS: RegExp;
  readonly BUFFER_STABLE: number;
  readonly BUFFER_VARIABLE: number;
  readonly BUFFER_UNCERTAIN: number;
  readonly BUFFER_DEFAULT: number;
  readonly BUFFER_CRITICAL_LOW_STABLE: number;
  readonly BUFFER_CRITICAL_LOW_VARIABLE: number;
  readonly BUFFER_CRITICAL_LOW_UNCERTAIN: number;
  readonly BUFFER_CRITICAL_LOW_DEFAULT: number;
  readonly BUFFER_EMERGENCY_STABLE: number;
  readonly BUFFER_EMERGENCY_VARIABLE: number;
  readonly BUFFER_EMERGENCY_UNCERTAIN: number;
  readonly BUFFER_EMERGENCY_DEFAULT: number;
  readonly LOW_FUNDS_CRITICAL_BUFFER_THRESHOLD: number;
  readonly EMERGENCY_LEVEL0_DEBT_COUNT: number;
  readonly LEVEL0_URGENT_DEADLINE_DAYS: number;
  readonly LEVEL0_URGENT_MIN_COVERAGE: number;
  readonly LEVEL1_MICROLOAN_SHARE_MIN: number;
  readonly LEVEL1_MICROLOAN_SHARE_MAX: number;
  readonly LEVEL1_REGULAR_SHARE_MIN: number;
  readonly LEVEL1_REGULAR_SHARE_MAX: number;
  readonly LEVEL1_HIGH_INTEREST_THRESHOLD: number;
  readonly LEVEL1_COST_OVERDUE_PENALTY: number;
  readonly LEVEL1_DEFAULT_RATE_LOANS: number;
  readonly LEVEL1_DEFAULT_RATE_CREDIT_CARD: number;
  readonly LEVEL1_DEFAULT_RATE_OTHER: number;
  readonly LEVEL1_MICROLOAN_RATE_BONUS: number;
  readonly MICROLOAN_KEYWORDS: RegExp;
  readonly ALLOCATION_DEBT_CAP: number;
  readonly MIN_ALLOCATION_WEIGHT: number;
  readonly BUFFER_DEFICIT_BONUS_STABLE: number;
  readonly BUFFER_DEFICIT_BONUS_VARIABLE: number;
  readonly BUFFER_DEFICIT_BONUS_UNCERTAIN: number;
  readonly MAX_BUFFER_PERCENT: number;
  readonly DEFICIT_SPENDABLE_REDUCTION: number;
};

/** Immutable konfigurace Priority Engine — jediný zdroj pravdy pro váhy a prahy. */
export const PRIORITY_CONSTANTS = {
  CATEGORY_WEIGHT: {
    housing: 1.0,
    utilities: 0.9,
    taxes: 0.95,
    fines: 0.9,
    medical: 0.75,
    transport: 0.7,
    food: 0.65,
    subscriptions: 0.4,
    loans: 0.6,
    credit_card: 0.45,
    other: 0.35,
  },
  LEVEL_WEIGHT: { 0: 100, 1: 75, 2: 50, 3: 25 },
  ESSENTIAL_CATEGORIES: ["housing", "utilities", "taxes", "fines"],
  AUTO_EXECUTION_CATEGORIES: ["fines", "taxes"],
  EXECUTION_KEYWORDS:
    /exeku|výkon\s+rozsudku|soudní\s+exekutor|executor|enforcement|выселен|исполнител|фссп|судебн.*пристав|пристав|арест\s+сч|принудительн|взыскан/i,
  BUFFER_STABLE: 0.2,
  BUFFER_VARIABLE: 0.28,
  BUFFER_UNCERTAIN: 0.35,
  BUFFER_DEFAULT: 0.25,
  BUFFER_CRITICAL_LOW_STABLE: 0.08,
  BUFFER_CRITICAL_LOW_VARIABLE: 0.09,
  BUFFER_CRITICAL_LOW_UNCERTAIN: 0.1,
  BUFFER_CRITICAL_LOW_DEFAULT: 0.09,
  BUFFER_EMERGENCY_STABLE: 0.08,
  BUFFER_EMERGENCY_VARIABLE: 0.09,
  BUFFER_EMERGENCY_UNCERTAIN: 0.1,
  BUFFER_EMERGENCY_DEFAULT: 0.09,
  LOW_FUNDS_CRITICAL_BUFFER_THRESHOLD: 15_000,
  EMERGENCY_LEVEL0_DEBT_COUNT: 2,
  LEVEL0_URGENT_DEADLINE_DAYS: 5,
  LEVEL0_URGENT_MIN_COVERAGE: 0.7,
  LEVEL1_MICROLOAN_SHARE_MIN: 0.7,
  LEVEL1_MICROLOAN_SHARE_MAX: 0.9,
  LEVEL1_REGULAR_SHARE_MIN: 0.5,
  LEVEL1_REGULAR_SHARE_MAX: 0.7,
  LEVEL1_HIGH_INTEREST_THRESHOLD: 30,
  LEVEL1_COST_OVERDUE_PENALTY: 30,
  LEVEL1_DEFAULT_RATE_LOANS: 12,
  LEVEL1_DEFAULT_RATE_CREDIT_CARD: 22,
  LEVEL1_DEFAULT_RATE_OTHER: 5,
  LEVEL1_MICROLOAN_RATE_BONUS: 35,
  MICROLOAN_KEYWORDS:
    /mikro|payday|rychl|fast.?loan|online.?půj|sms|mini.?půj|z[aá]jm|půjč|займ|микрозайм|быстр.*займ/i,
  ALLOCATION_DEBT_CAP: 50_000,
  MIN_ALLOCATION_WEIGHT: 5,
  BUFFER_DEFICIT_BONUS_STABLE: 0.05,
  BUFFER_DEFICIT_BONUS_VARIABLE: 0.08,
  BUFFER_DEFICIT_BONUS_UNCERTAIN: 0.1,
  MAX_BUFFER_PERCENT: 0.45,
  DEFICIT_SPENDABLE_REDUCTION: 0.25,
} as const satisfies PriorityConstantsShape;

/** Typ odvozený z {@link PRIORITY_CONSTANTS} — plná typová bezpečnost konfigurace. */
export type PriorityConstants = typeof PRIORITY_CONSTANTS;

const { EXECUTION_KEYWORDS } = PRIORITY_CONSTANTS;

const ESSENTIAL_CATEGORY_SET: ReadonlySet<DebtCategory> = new Set(
  PRIORITY_CONSTANTS.ESSENTIAL_CATEGORIES
);

const AUTO_EXECUTION_CATEGORY_SET: ReadonlySet<DebtCategory> = new Set(
  PRIORITY_CONSTANTS.AUTO_EXECUTION_CATEGORIES
);

const PRIORITY_LEVELS: readonly PriorityLevel[] = [0, 1, 2, 3];

const MS_PER_DAY = 86_400_000;

// ─── Sanitizace ──────────────────────────────────────────────────────────────

/**
 * Normalizuje číselnou částku: odmítne `null`, NaN, Infinity a záporné hodnoty.
 * Vrací nezáporné konečné číslo (0 jako fallback).
 */
function sanitizeAmount(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/**
 * Normalizuje úrokovou sazbu — pouze konečná nezáporná čísla, jinak `undefined`.
 */
function sanitizeRate(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

/**
 * Vrátí bezpečně sanitizovaný finanční profil pro engine.
 *
 * Volá se jednou na začátku `runPriorityEngine`. Všechny částky v dlužích
 * (`amount`, `minimumPayment`) a `availableFunds` jsou garantovaně ≥ 0 a konečné.
 * Neplatný profil (chybí pole) se normalizuje na prázdný seznam dluhů a 0 Kč.
 */
function sanitizeProfile(profile: FinancialProfile): FinancialProfile {
  const debts = Array.isArray(profile.debts) ? profile.debts : [];

  return {
    ...profile,
    availableFunds: sanitizeAmount(profile.availableFunds),
    monthlyIncome:
      profile.monthlyIncome !== undefined
        ? sanitizeAmount(profile.monthlyIncome)
        : profile.monthlyIncome,
    monthlyExpenses:
      profile.monthlyExpenses !== undefined
        ? sanitizeAmount(profile.monthlyExpenses)
        : profile.monthlyExpenses,
    recurringIncomes: Array.isArray(profile.recurringIncomes)
      ? profile.recurringIncomes
      : undefined,
    recurringExpenses: Array.isArray(profile.recurringExpenses)
      ? profile.recurringExpenses
      : undefined,
    debts: debts.map((debt) => ({
      ...debt,
      amount: sanitizeAmount(debt.amount),
      minimumPayment:
        debt.minimumPayment !== undefined
          ? sanitizeAmount(debt.minimumPayment)
          : debt.minimumPayment,
      interestRate: sanitizeRate(debt.interestRate),
    })),
  };
}

function isEssentialCategory(category: DebtCategory): boolean {
  return ESSENTIAL_CATEGORY_SET.has(category);
}

type BufferMode = "standard" | "critical" | "emergency";

function resolveBufferMode(
  hasLevel0Debt: boolean,
  level0Count: number,
  availableFunds: number
): BufferMode {
  if (!hasLevel0Debt) return "standard";

  const funds = sanitizeAmount(availableFunds);
  if (funds >= PRIORITY_CONSTANTS.LOW_FUNDS_CRITICAL_BUFFER_THRESHOLD) {
    return "standard";
  }

  if (level0Count >= PRIORITY_CONSTANTS.EMERGENCY_LEVEL0_DEBT_COUNT) {
    return "emergency";
  }

  return "critical";
}

function bufferPercentForStability(
  stability: IncomeStability | undefined,
  mode: BufferMode
): number {
  if (mode === "standard") {
    switch (stability) {
      case "stable":
        return PRIORITY_CONSTANTS.BUFFER_STABLE;
      case "variable":
        return PRIORITY_CONSTANTS.BUFFER_VARIABLE;
      case "uncertain":
        return PRIORITY_CONSTANTS.BUFFER_UNCERTAIN;
      default:
        return PRIORITY_CONSTANTS.BUFFER_DEFAULT;
    }
  }

  const emergency = mode === "emergency";
  switch (stability) {
    case "stable":
      return emergency
        ? PRIORITY_CONSTANTS.BUFFER_EMERGENCY_STABLE
        : PRIORITY_CONSTANTS.BUFFER_CRITICAL_LOW_STABLE;
    case "variable":
      return emergency
        ? PRIORITY_CONSTANTS.BUFFER_EMERGENCY_VARIABLE
        : PRIORITY_CONSTANTS.BUFFER_CRITICAL_LOW_VARIABLE;
    case "uncertain":
      return emergency
        ? PRIORITY_CONSTANTS.BUFFER_EMERGENCY_UNCERTAIN
        : PRIORITY_CONSTANTS.BUFFER_CRITICAL_LOW_UNCERTAIN;
    default:
      return emergency
        ? PRIORITY_CONSTANTS.BUFFER_EMERGENCY_DEFAULT
        : PRIORITY_CONSTANTS.BUFFER_CRITICAL_LOW_DEFAULT;
  }
}

function needsReducedBuffer(
  hasLevel0Debt: boolean,
  availableFunds: number
): boolean {
  return (
    hasLevel0Debt &&
    availableFunds < PRIORITY_CONSTANTS.LOW_FUNDS_CRITICAL_BUFFER_THRESHOLD
  );
}

function isEmergencyBufferMode(
  hasLevel0Debt: boolean,
  level0Count: number,
  availableFunds: number
): boolean {
  return resolveBufferMode(hasLevel0Debt, level0Count, availableFunds) === "emergency";
}

// ─── Pomocné funkce ────────────────────────────────────────────────────────

/**
 * Detekuje riziko exekuce / enforcement.
 * Kategorie `fines` a `taxes` jsou vždy execution risk; dále text v poznámkách.
 */
export function isExecutionRisk(debt: Debt): boolean {
  if (AUTO_EXECUTION_CATEGORY_SET.has(debt.category)) {
    return true;
  }

  const text = [debt.criticalNote, debt.notes, debt.creditor]
    .filter(Boolean)
    .join(" ");
  return EXECUTION_KEYWORDS.test(text);
}

/** Vrátí nejbližší termín v dnech (minimum ze splatnosti a kritického data). */
export function nearestDeadlineDays(
  daysToDue: number | null,
  daysToCritical: number | null
): number | null {
  const candidates = [daysToDue, daysToCritical].filter(
    (d): d is number => d !== null && Number.isFinite(d)
  );
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

/** Má dluh více nezávislých termínů? */
export function hasMultipleDeadlines(
  daysToDue: number | null,
  daysToCritical: number | null
): boolean {
  return daysToDue !== null && daysToCritical !== null;
}

/** Počet celých dní od `from` do `to` (kladné = budoucnost). */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.ceil(ms / MS_PER_DAY);
}

function parseDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Vypočítá procento životního bufferu podle stability příjmu (standardní režim).
 * stable → 20 %, variable → 28 %, uncertain → 35 %, neznámé → 25 %
 */
export function calculateLifeBufferPercent(
  stability?: IncomeStability
): number {
  return bufferPercentForStability(stability, "standard");
}

/**
 * Finální procento life bufferu včetně sníženého (8–12 %) a emergency režimu.
 *
 * Snížený buffer platí, pokud existuje dluh úrovně 0 a sanitizované
 * `availableFunds` jsou pod `LOW_FUNDS_CRITICAL_BUFFER_THRESHOLD`.
 * Emergency (≥2 dluhy úrovně 0 + nízké prostředky) používá 8–12 % dle stability.
 *
 * @param stability — stabilita příjmu z profilu
 * @param options.hasLevel0Debt — alespoň jeden dluh úrovně 0 po analýze
 * @param options.availableFunds — sanitizované volné prostředky
 * @param options.level0Count — počet dluhů úrovně 0 (pro emergency režim)
 */
export function resolveLifeBufferPercent(
  stability: IncomeStability | undefined,
  options: {
    hasLevel0Debt: boolean;
    availableFunds: number;
    level0Count?: number;
    /** Pro cash flow — adjusts stability and adds deficit buffer bonus. */
    cashFlow?: ProEngineCashFlowContext;
  }
): number {
  const funds = sanitizeAmount(options.availableFunds);
  const level0Count = options.level0Count ?? (options.hasLevel0Debt ? 1 : 0);
  const mode = resolveBufferMode(options.hasLevel0Debt, level0Count, funds);
  const effectiveStability =
    options.cashFlow?.effectiveStability ?? stability;
  let percent = bufferPercentForStability(effectiveStability, mode);

  if (options.cashFlow && options.cashFlow.netMonthlyCashFlow < 0) {
    const hasSignal =
      options.cashFlow.incomeFromRecurring ||
      options.cashFlow.expensesFromRecurring ||
      options.cashFlow.monthlyIncome > 0 ||
      options.cashFlow.monthlyExpenses > 0;
    if (hasSignal) {
      const bonus =
        effectiveStability === "uncertain"
          ? PRIORITY_CONSTANTS.BUFFER_DEFICIT_BONUS_UNCERTAIN
          : effectiveStability === "variable"
            ? PRIORITY_CONSTANTS.BUFFER_DEFICIT_BONUS_VARIABLE
            : PRIORITY_CONSTANTS.BUFFER_DEFICIT_BONUS_STABLE;
      percent = Math.min(
        PRIORITY_CONSTANTS.MAX_BUFFER_PERCENT,
        percent + bonus
      );
    }
  }

  return percent;
}

/**
 * Absolute life buffer: max(percent × planning funds, expense floor, 20–30% cash flow floor),
 * capped at actual available funds.
 */
export function resolveLifeBufferAmount(
  availableFunds: number,
  bufferPercent: number,
  cashFlow?: ProEngineCashFlowContext,
  planningFunds?: number
): number {
  const actualFunds = sanitizeAmount(availableFunds);
  const planningBase = sanitizeAmount(planningFunds ?? availableFunds);
  const percentBased = planningBase * bufferPercent;
  const expenseFloor = cashFlow?.expenseBasedMinBuffer ?? 0;
  const cashFlowFloor = cashFlow?.cashFlowBasedMinBuffer ?? 0;
  return roundMoney(
    Math.min(actualFunds, Math.max(percentBased, expenseFloor, cashFlowFloor))
  );
}

/**
 * When monthly net cash flow is negative, reserve part of spendable for next month.
 */
function applyDeficitSpendableGuard(
  spendable: number,
  cashFlow: ProEngineCashFlowContext
): number {
  if (cashFlow.netMonthlyCashFlow >= 0) return spendable;
  const hasSignal =
    cashFlow.incomeFromRecurring ||
    cashFlow.expensesFromRecurring ||
    cashFlow.monthlyIncome > 0 ||
    cashFlow.monthlyExpenses > 0;
  if (!hasSignal) return spendable;
  const reduction = spendable * PRIORITY_CONSTANTS.DEFICIT_SPENDABLE_REDUCTION;
  return roundMoney(Math.max(0, spendable - reduction));
}

export { buildProEngineCashFlowContext };
export type { ProEngineCashFlowContext };

// ─── Určení úrovně priority ────────────────────────────────────────────────

export interface DebtAnalysis {
  debt: Debt;
  level: PriorityLevel;
  urgencyScore: number;
  daysToDue: number | null;
  daysToCritical: number | null;
  factors: string[];
}

/** Optional Pro cash-flow context for {@link analyzeDebt}. */
export interface AnalyzeDebtOptions {
  cashFlow?: ProEngineCashFlowContext;
}

/**
 * Přiřadí úroveň priority 0–3 a skóre naléhavosti jednomu dluhu.
 *
 * **Úroveň 0:** execution risk; esenciál po splatnosti; kritický termín ≤0 / ≤3 dny;
 * nejbližší termín ≤0 / ≤3 dny pouze u esenciálů nebo execution risk.
 *
 * With Pro recurring data, negative net cash flow and short-term forecast pressure
 * can elevate level 2 → 1 and boost urgency scores.
 */
export function analyzeDebt(
  debt: Debt,
  today: Date = new Date(),
  options?: AnalyzeDebtOptions
): DebtAnalysis {
  const due = parseDate(debt.dueDate);
  const critical = parseDate(debt.criticalDate);

  const daysToDue = due ? daysBetween(today, due) : null;
  const daysToCritical = critical ? daysBetween(today, critical) : null;

  const factors: string[] = [];
  let level: PriorityLevel = 3;

  const execution = isExecutionRisk(debt);
  const essential = isEssentialCategory(debt.category);
  const multipleDeadlines = hasMultipleDeadlines(daysToDue, daysToCritical);
  const nearest = nearestDeadlineDays(daysToDue, daysToCritical);

  if (multipleDeadlines) factors.push("multiple_deadlines");
  if (execution) factors.push("execution_risk");

  const criticalImminent = daysToCritical !== null && daysToCritical <= 3;
  const criticalPassed = daysToCritical !== null && daysToCritical <= 0;
  const essentialOverdue = daysToDue !== null && daysToDue < 0 && essential;
  const nearestImminent = nearest !== null && nearest <= 3;
  const nearestPassed = nearest !== null && nearest <= 0;
  const nearestEscalatesToZero =
    (nearestImminent || nearestPassed) && (essential || execution);

  if (
    execution ||
    criticalPassed ||
    criticalImminent ||
    essentialOverdue ||
    nearestEscalatesToZero
  ) {
    level = 0;
    if (execution) factors.push("execution");
    if (criticalPassed) factors.push("critical_passed");
    if (criticalImminent) factors.push("critical_imminent");
    if (essentialOverdue) factors.push("essential_overdue");
    if (nearestImminent && !criticalImminent) factors.push("nearest_imminent");
    if (nearestPassed && !criticalPassed) factors.push("nearest_passed");
  } else if (
    (daysToDue !== null && daysToDue <= 7) ||
    (daysToCritical !== null && daysToCritical <= 14) ||
    (daysToDue !== null && daysToDue < 0) ||
    (nearest !== null && nearest <= 7)
  ) {
    level = 1;
    if (daysToDue !== null && daysToDue <= 7) factors.push("due_soon");
    if (daysToCritical !== null && daysToCritical <= 14)
      factors.push("critical_soon");
    if (daysToDue !== null && daysToDue < 0) factors.push("overdue");
  } else if (
    (daysToDue !== null && daysToDue <= 30) ||
    (essential && !due && !critical)
  ) {
    level = 2;
    if (daysToDue !== null && daysToDue <= 30) factors.push("due_month");
    if (essential) factors.push("essential");
  } else {
    level = 3;
    factors.push("low_urgency");
  }

  let urgencyScore =
    PRIORITY_CONSTANTS.LEVEL_WEIGHT[level] *
    PRIORITY_CONSTANTS.CATEGORY_WEIGHT[debt.category];

  if (daysToCritical !== null) {
    if (daysToCritical <= 0) urgencyScore += 80;
    else if (daysToCritical <= 7) urgencyScore += 60;
    else if (daysToCritical <= 14) urgencyScore += 40;
  }

  if (daysToDue !== null) {
    if (daysToDue < 0) urgencyScore += 50;
    else if (daysToDue <= 3) urgencyScore += 40;
    else if (daysToDue <= 7) urgencyScore += 25;
    else if (daysToDue <= 14) urgencyScore += 15;
  }

  if (debt.interestRate !== undefined && debt.interestRate > 15) {
    urgencyScore += 10;
  }

  if (execution) urgencyScore += 100;

  if (multipleDeadlines && nearest !== null) {
    if (nearest <= 3) urgencyScore += 30;
    else if (nearest <= 7) urgencyScore += 15;
  }

  const analysis: DebtAnalysis = {
    debt,
    level,
    urgencyScore,
    daysToDue,
    daysToCritical,
    factors,
  };
  applyCashFlowStressToAnalysis(analysis, options?.cashFlow, nearest);
  analysis.urgencyScore = Math.max(0, analysis.urgencyScore);

  return analysis;
}

/** Boost urgency / elevate level when Pro recurring cash flow is under pressure. */
function applyCashFlowStressToAnalysis(
  analysis: DebtAnalysis,
  cashFlow: ProEngineCashFlowContext | undefined,
  nearest: number | null
): void {
  if (!cashFlow) return;

  const hasRecurring =
    cashFlow.incomeFromRecurring || cashFlow.expensesFromRecurring;
  if (!hasRecurring) return;

  const debtMin =
    analysis.debt.minimumPayment ?? analysis.debt.amount;

  if (cashFlow.netMonthlyCashFlow < 0) {
    analysis.factors.push("recurring_cash_flow_deficit");
    if (analysis.level === 2 && nearest !== null && nearest <= 30) {
      analysis.level = 1;
      analysis.factors.push("elevated_by_deficit");
    }
    if (analysis.level === 1) analysis.urgencyScore += 15;
  }

  if (
    cashFlow.netMonthlyCashFlow < debtMin &&
    nearest !== null &&
    nearest <= 30
  ) {
    analysis.factors.push("payment_exceeds_surplus");
    analysis.urgencyScore += 20;
    if (analysis.level === 2) {
      analysis.level = 1;
      analysis.factors.push("elevated_by_affordability");
    }
  }

  const monthOne = cashFlow.shortTermForecast[0];
  if (
    monthOne &&
    monthOne.endingBalance < debtMin &&
    nearest !== null &&
    nearest <= 45
  ) {
    analysis.factors.push("forecast_pressure");
    analysis.urgencyScore += 12;
  }
}

// ─── Lokalizace vysvětlení ─────────────────────────────────────────────────

const LEVEL_LABELS: Record<PriorityLevel, Record<Locale, string>> = {
  0: { cs: "Kritický", ru: "Критический", en: "Critical" },
  1: { cs: "Vysoký", ru: "Высокий", en: "High" },
  2: { cs: "Střední", ru: "Средний", en: "Medium" },
  3: { cs: "Nízký", ru: "Низкий", en: "Low" },
};

const CATEGORY_LABELS: Record<DebtCategory, Record<Locale, string>> = {
  housing: { cs: "bydlení", ru: "жильё / аренда", en: "housing" },
  utilities: { cs: "energie a služby", ru: "ЖКХ и коммуналка", en: "utilities" },
  taxes: { cs: "daně", ru: "налоги / ФНС", en: "taxes" },
  fines: { cs: "pokuty", ru: "штрафы / приставы", en: "fines" },
  loans: { cs: "půjčky", ru: "кредиты", en: "loans" },
  credit_card: { cs: "kreditní karta", ru: "кредитная карта", en: "credit card" },
  medical: { cs: "zdravotní", ru: "медицина", en: "medical" },
  transport: { cs: "doprava", ru: "транспорт", en: "transport" },
  food: { cs: "jídlo", ru: "еда", en: "food" },
  subscriptions: { cs: "předplatné", ru: "подписки", en: "subscriptions" },
  other: { cs: "ostatní", ru: "прочее", en: "other" },
};

function appendLevelHeader(
  parts: string[],
  analysis: DebtAnalysis,
  locale: Locale
): void {
  const levelLabel = LEVEL_LABELS[analysis.level][locale];
  const catLabel = CATEGORY_LABELS[analysis.debt.category][locale];

  if (locale === "cs") {
    parts.push(`Úroveň ${analysis.level} (${levelLabel}) — kategorie: ${catLabel}.`);
  } else if (locale === "ru") {
    parts.push(`Уровень ${analysis.level} (${levelLabel}) — категория: ${catLabel}.`);
  } else {
    parts.push(`Level ${analysis.level} (${levelLabel}) — category: ${catLabel}.`);
  }
}

function appendDeadlineInfo(
  parts: string[],
  analysis: DebtAnalysis,
  locale: Locale
): void {
  const { debt, daysToDue, daysToCritical } = analysis;

  if (debt.criticalNote && debt.criticalDate) {
    if (locale === "cs") {
      parts.push(`${debt.criticalNote} (termín ${debt.criticalDate}).`);
    } else if (locale === "ru") {
      parts.push(`${debt.criticalNote} (срок ${debt.criticalDate}).`);
    } else {
      parts.push(`${debt.criticalNote} (deadline ${debt.criticalDate}).`);
    }
    return;
  }

  if (daysToCritical !== null && daysToCritical <= 7) {
    if (locale === "cs") {
      parts.push(`Kritický termín za ${daysToCritical} dní.`);
    } else if (locale === "ru") {
      parts.push(`Критический срок через ${daysToCritical} дн.`);
    } else {
      parts.push(`Critical deadline in ${daysToCritical} days.`);
    }
  }

  if (daysToDue !== null && daysToDue < 0) {
    if (locale === "cs") parts.push("Závazek je po splatnosti.");
    else if (locale === "ru") parts.push("Обязательство просрочено.");
    else parts.push("Payment is overdue.");
  } else if (daysToDue !== null && daysToDue <= 7) {
    if (locale === "cs") parts.push(`Splatnost za ${daysToDue} dní.`);
    else if (locale === "ru") parts.push(`Срок через ${daysToDue} дн.`);
    else parts.push(`Due in ${daysToDue} days.`);
  }
}

function appendFactorNotes(
  parts: string[],
  analysis: DebtAnalysis,
  locale: Locale
): void {
  const { factors } = analysis;

  if (factors.includes("essential")) {
    if (locale === "cs") {
      parts.push("Esenciální výdaj — riziko vypnutí služeb nebo právních důsledků.");
    } else if (locale === "ru") {
      parts.push(
        "Обязательный расход — риск отключения услуг или юридических последствий."
      );
    } else {
      parts.push("Essential expense — risk of service cutoff or legal consequences.");
    }
  }

  if (factors.includes("execution") || factors.includes("execution_risk")) {
    if (locale === "cs") {
      parts.push("Riziko exekuce — nejvyšší právní priorita.");
    } else if (locale === "ru") {
      parts.push("Риск исполнительного производства или ФССП — наивысший приоритет.");
    } else {
      parts.push("Enforcement risk — highest legal priority.");
    }
  }

  if (factors.includes("multiple_deadlines")) {
    if (locale === "cs") parts.push("Více termínů — rozhodujeme podle nejbližšího.");
    else if (locale === "ru") parts.push("Несколько сроков — ориентируемся на ближайший.");
    else parts.push("Multiple deadlines — using the nearest date.");
  }
}

function appendAllocationNote(
  parts: string[],
  allocated: number,
  sharePercent: number,
  locale: Locale
): void {
  if (locale === "cs") {
    parts.push(
      `Alokováno ${formatMoney(allocated, locale)} (${sharePercent.toFixed(0)} % disponibilní částky pro tuto úroveň).`
    );
  } else if (locale === "ru") {
    parts.push(
      `Выделено ${formatMoney(allocated, locale)} (${sharePercent.toFixed(0)} % пула этого уровня).`
    );
  } else {
    parts.push(
      `Allocated ${formatMoney(allocated, locale)} (${sharePercent.toFixed(0)}% of level pool).`
    );
  }
}

/** Sestaví lidsky čitelné vysvětlení rozhodnutí pro daný dluh a alokaci. */
export function buildExplanation(
  analysis: DebtAnalysis,
  allocated: number,
  sharePercent: number,
  locale: Locale
): string {
  const parts: string[] = [];
  appendLevelHeader(parts, analysis, locale);
  appendDeadlineInfo(parts, analysis, locale);
  appendFactorNotes(parts, analysis, locale);
  appendAllocationNote(parts, allocated, sharePercent, locale);
  return parts.join(" ");
}

function buildShortReason(analysis: DebtAnalysis, locale: Locale): string {
  const label = LEVEL_LABELS[analysis.level][locale];
  const cat = CATEGORY_LABELS[analysis.debt.category][locale];

  if (locale === "cs") return `${label} priorita · ${cat}`;
  if (locale === "ru") return `${label} приоритет · ${cat}`;
  return `${label} priority · ${cat}`;
}

// ─── Proporcionální alokace ────────────────────────────────────────────────

interface AllocationState {
  debtId: string;
  analysis: DebtAnalysis;
  paid: number;
  /** Zbývající dlužná částka — sanitizovaná jednou při vytvoření stavu */
  stillOwed: number;
}

/** Vytvoří počáteční stavy alokace z analýz (částky již sanitizované v profilu). */
function buildAllocationStates(analyses: DebtAnalysis[]): AllocationState[] {
  return analyses.map((analysis) => ({
    debtId: analysis.debt.id,
    analysis,
    paid: 0,
    stillOwed: analysis.debt.amount,
  }));
}

/**
 * Vypočítá váhu dluhu pro proporcionální alokaci.
 *
 * @param urgencyScore — skóre naléhavosti z {@link analyzeDebt} (≥ 0)
 * @param stillOwed — sanitizovaný zbytek dluhu z {@link AllocationState}
 * @returns váha ≥ `MIN_ALLOCATION_WEIGHT`
 */
function allocationWeight(urgencyScore: number, stillOwed: number): number {
  const score = Math.max(0, urgencyScore);
  const cappedOwed = Math.min(stillOwed, PRIORITY_CONSTANTS.ALLOCATION_DEBT_CAP);
  const owedFactor = Math.max(cappedOwed, 1);
  const raw = score * owedFactor;
  return Math.max(PRIORITY_CONSTANTS.MIN_ALLOCATION_WEIGHT, raw);
}

/**
 * Proporcionálně rozdělí `pool` mezi dluhy stejné priority.
 * Předpokládá, že `items[].stillOwed` je již sanitizované.
 */
function allocateProportionally(
  items: readonly AllocationState[],
  pool: number
): Map<string, number> {
  const result = new Map<string, number>();
  const safePool = sanitizeAmount(pool);

  if (safePool <= 0 || items.length === 0) return result;

  let remaining = safePool;

  const weights = items.map((item) => ({
    id: item.debtId,
    weight: allocationWeight(item.analysis.urgencyScore, item.stillOwed),
    cap: item.stillOwed,
  }));

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0 || !Number.isFinite(totalWeight)) return result;

  for (const weight of weights) {
    const rawShare = (weight.weight / totalWeight) * safePool;
    const amount = roundMoney(Math.min(rawShare, weight.cap, remaining));

    if (amount > 0) {
      result.set(weight.id, (result.get(weight.id) ?? 0) + amount);
      remaining -= amount;
    }
  }

  if (remaining > 0) {
    const byUrgency = [...items].sort(
      (a, b) => b.analysis.urgencyScore - a.analysis.urgencyScore
    );

    for (const item of byUrgency) {
      if (remaining <= 0) break;

      const current = result.get(item.debtId) ?? 0;
      const canAdd = item.stillOwed - current;
      if (canAdd <= 0) continue;

      const add = Math.min(canAdd, remaining);
      result.set(item.debtId, current + add);
      remaining -= add;
    }
  }

  return result;
}

/** Nejbližší termín pro řazení dluhů úrovně 0 (větší = méně naléhavé). */
function level0NearestDays(analysis: DebtAnalysis): number {
  const nearest = nearestDeadlineDays(
    analysis.daysToDue,
    analysis.daysToCritical
  );
  return nearest ?? 9999;
}

/** Seřadí dluhy úrovně 0: nejdřív nejbližší termín, pak urgencyScore. */
function sortLevel0ByUrgency(items: readonly AllocationState[]): AllocationState[] {
  return [...items].sort((a, b) => {
    const deadlineDiff =
      level0NearestDays(a.analysis) - level0NearestDays(b.analysis);
    if (deadlineDiff !== 0) return deadlineDiff;
    return b.analysis.urgencyScore - a.analysis.urgencyScore;
  });
}

/**
 * Alokace poolu pro úroveň 0 — prioritně nejurgentnější dluh, ne rovnoměrné dělení.
 *
 * 1. Ultra-urgent (≤5 dní): cíl 70–100 % původní částky dluhu
 * 2. Greedy dle termínu: nejurgentnější dostane maximum, pak další
 * 3. Proporcionální zbytek mezi zbývající level-0 dluhy
 */
function allocateLevel0Pool(
  levelItems: readonly AllocationState[],
  pool: number,
  stateById: Map<string, AllocationState>,
  allocations: Map<string, number>,
  levelPools: Map<PriorityLevel, number>
): number {
  let remaining = sanitizeAmount(pool);
  const active = levelItems.filter((item) => item.stillOwed > 0);
  if (remaining <= 0 || active.length === 0) return remaining;

  const sorted = sortLevel0ByUrgency(active);
  const urgentDays = PRIORITY_CONSTANTS.LEVEL0_URGENT_DEADLINE_DAYS;
  const minCoverage = PRIORITY_CONSTANTS.LEVEL0_URGENT_MIN_COVERAGE;

  // Fáze A: ultra-urgent — min. 70 % původní částky, ideálně 100 %
  for (const state of sorted) {
    if (remaining <= 0) break;
    if (level0NearestDays(state.analysis) > urgentDays) continue;

    const debtTotal = state.analysis.debt.amount;
    const minTarget = roundMoney(debtTotal * minCoverage);
    let pay = Math.min(state.stillOwed, remaining);

    if (pay < minTarget && remaining >= minTarget) {
      pay = Math.min(minTarget, state.stillOwed, remaining);
    }

    remaining -= applyAllocationToState(state, pay, allocations, levelPools);
  }

  // Fáze B: greedy podle termínu — nejurgentnější dostane maximum
  for (const state of sorted) {
    if (remaining <= 0) break;
    if (state.stillOwed <= 0) continue;

    const pay = Math.min(state.stillOwed, remaining);
    remaining -= applyAllocationToState(state, pay, allocations, levelPools);
  }

  // Fáze C: proporcionální zbytek (edge case)
  const unpaid = sorted.filter((item) => item.stillOwed > 0);
  if (remaining > 0 && unpaid.length > 0) {
    const levelAlloc = allocateProportionally(unpaid, remaining);
    for (const [debtId, amount] of levelAlloc) {
      const state = stateById.get(debtId);
      if (!state) continue;
      remaining -= applyAllocationToState(state, amount, allocations, levelPools);
    }
  }

  return remaining;
}

/** Odhad efektivní sazby dle kategorie, pokud není uvedena. */
function defaultInterestRateForCategory(category: DebtCategory): number {
  switch (category) {
    case "credit_card":
      return PRIORITY_CONSTANTS.LEVEL1_DEFAULT_RATE_CREDIT_CARD;
    case "loans":
      return PRIORITY_CONSTANTS.LEVEL1_DEFAULT_RATE_LOANS;
    default:
      return PRIORITY_CONSTANTS.LEVEL1_DEFAULT_RATE_OTHER;
  }
}

function isMicroloanDebt(debt: Debt): boolean {
  const text = `${debt.creditor} ${debt.notes ?? ""}`;
  return PRIORITY_CONSTANTS.MICROLOAN_KEYWORDS.test(text);
}

/** Mikropůjčka dle sazby (>30 %) nebo klíčových slov v názvu/poznámce. */
function isHighCostMicroloan(debt: Debt): boolean {
  if (
    debt.interestRate !== undefined &&
    debt.interestRate > PRIORITY_CONSTANTS.LEVEL1_HIGH_INTEREST_THRESHOLD
  ) {
    return true;
  }
  return isMicroloanDebt(debt);
}

/**
 * Skóre „ceny peněz“ pro řazení dluhů úrovně 1 — vyšší = dražší dluh.
 * Kombinuje úrok, prodlení, vysokou sazbu a signály mikropůjčky.
 */
function level1CostScore(analysis: DebtAnalysis): number {
  const { debt, daysToDue } = analysis;
  let rate = debt.interestRate ?? defaultInterestRateForCategory(debt.category);

  if (isHighCostMicroloan(debt)) {
    rate += PRIORITY_CONSTANTS.LEVEL1_MICROLOAN_RATE_BONUS;
  } else if (
    debt.interestRate !== undefined &&
    debt.interestRate > PRIORITY_CONSTANTS.LEVEL1_HIGH_INTEREST_THRESHOLD
  ) {
    rate += debt.interestRate - PRIORITY_CONSTANTS.LEVEL1_HIGH_INTEREST_THRESHOLD;
  }

  if (daysToDue !== null && daysToDue < 0) {
    rate += PRIORITY_CONSTANTS.LEVEL1_COST_OVERDUE_PENALTY;
    rate += Math.min(20, Math.abs(daysToDue) * 2);
  }

  return rate;
}

/** Seřadí dluhy úrovně 1: nejdražší dluh první, pak urgencyScore. */
function sortLevel1ByCost(items: readonly AllocationState[]): AllocationState[] {
  return [...items].sort((a, b) => {
    const costDiff = level1CostScore(b.analysis) - level1CostScore(a.analysis);
    if (costDiff !== 0) return costDiff;
    return b.analysis.urgencyScore - a.analysis.urgencyScore;
  });
}

/**
 * Podíl poolu pro nejdražší dluh — 70–90 % mikropůjčka, 50–70 % běžný úvěr.
 * Vyšší podíl při větším rozdílu v ceně peněz.
 */
function resolveLevel1AggressiveShare(
  topState: AllocationState,
  secondCost: number
): number {
  const topCost = level1CostScore(topState.analysis);
  const microloan = isHighCostMicroloan(topState.analysis.debt);
  const minShare = microloan
    ? PRIORITY_CONSTANTS.LEVEL1_MICROLOAN_SHARE_MIN
    : PRIORITY_CONSTANTS.LEVEL1_REGULAR_SHARE_MIN;
  const maxShare = microloan
    ? PRIORITY_CONSTANTS.LEVEL1_MICROLOAN_SHARE_MAX
    : PRIORITY_CONSTANTS.LEVEL1_REGULAR_SHARE_MAX;

  if (secondCost <= 0) return 1;

  const ratio = topCost / secondCost;
  if (ratio >= 2) return maxShare;
  if (ratio >= 1.5) return (minShare + maxShare) / 2;
  return minShare;
}

/**
 * Alokace poolu pro úroveň 1 — prioritně nejdražší dluh, ne rovnoměrné dělení.
 *
 * 1. Agresivní podíl 70–90 % (mikropůjčka) nebo 50–70 % (běžný úvěr) na top dluh
 * 2. Greedy dle ceny peněz: další dluhy až po vyčerpání prioritního
 * 3. Proporcionální zbytek (edge case)
 */
function allocateLevel1Pool(
  levelItems: readonly AllocationState[],
  pool: number,
  stateById: Map<string, AllocationState>,
  allocations: Map<string, number>,
  levelPools: Map<PriorityLevel, number>
): number {
  let remaining = sanitizeAmount(pool);
  const active = levelItems.filter((item) => item.stillOwed > 0);
  if (remaining <= 0 || active.length === 0) return remaining;

  const sorted = sortLevel1ByCost(active);
  const topState = sorted[0];

  if (sorted.length >= 2) {
    const secondCost = level1CostScore(sorted[1].analysis);
    const share = resolveLevel1AggressiveShare(topState, secondCost);
    const target = roundMoney(remaining * share);

    const pay = Math.min(topState.stillOwed, target, remaining);
    remaining -= applyAllocationToState(
      topState,
      pay,
      allocations,
      levelPools
    );
  } else {
    const microloan = isHighCostMicroloan(topState.analysis.debt);
    const share = microloan
      ? PRIORITY_CONSTANTS.LEVEL1_MICROLOAN_SHARE_MAX
      : PRIORITY_CONSTANTS.LEVEL1_REGULAR_SHARE_MAX;
    const target = roundMoney(remaining * share);
    const pay = Math.min(topState.stillOwed, target, remaining);
    remaining -= applyAllocationToState(topState, pay, allocations, levelPools);
  }

  for (const state of sorted) {
    if (remaining <= 0) break;
    if (state.stillOwed <= 0) continue;

    const pay = Math.min(state.stillOwed, remaining);
    remaining -= applyAllocationToState(state, pay, allocations, levelPools);
  }

  const unpaid = sorted.filter((item) => item.stillOwed > 0);
  if (remaining > 0 && unpaid.length > 0) {
    const levelAlloc = allocateProportionally(unpaid, remaining);
    for (const [debtId, amount] of levelAlloc) {
      const state = stateById.get(debtId);
      if (!state) continue;
      remaining -= applyAllocationToState(state, amount, allocations, levelPools);
    }
  }

  return remaining;
}

function applyAllocationToState(
  state: AllocationState,
  amount: number,
  allocations: Map<string, number>,
  levelPools: Map<PriorityLevel, number>
): number {
  if (amount <= 0) return 0;

  const applied = Math.min(amount, state.stillOwed);
  if (applied <= 0) return 0;

  allocations.set(state.debtId, (allocations.get(state.debtId) ?? 0) + applied);
  state.paid += applied;
  state.stillOwed -= applied;

  const level = state.analysis.level;
  levelPools.set(level, (levelPools.get(level) ?? 0) + applied);

  return applied;
}

/** Mapa stavů alokace podle ID dluhu — O(1) lookup místo opakovaného `find`. */
function indexStatesById(
  states: readonly AllocationState[]
): Map<string, AllocationState> {
  return new Map(states.map((state) => [state.debtId, state]));
}

/** Fáze: minimální splátky u úrovní 0 a 1. */
function applyMinimumPayments(
  states: AllocationState[],
  allocations: Map<string, number>,
  levelPools: Map<PriorityLevel, number>,
  spendable: number
): number {
  let remaining = spendable;

  for (const state of states) {
    if (remaining <= 0) break;
    if (state.analysis.level > 1) continue;

    const minimum = state.analysis.debt.minimumPayment ?? 0;
    if (minimum <= 0) continue;

    const pay = Math.min(minimum, state.stillOwed, remaining);
    remaining -= applyAllocationToState(state, pay, allocations, levelPools);
  }

  return remaining;
}

/** Fáze: proporcionální dělení po úrovních 0 → 3. Aktualizuje `levelPools` při alokaci. */
function applyProportionalByLevel(
  states: AllocationState[],
  stateById: Map<string, AllocationState>,
  allocations: Map<string, number>,
  levelPools: Map<PriorityLevel, number>,
  spendable: number
): number {
  let remaining = spendable;

  for (const level of PRIORITY_LEVELS) {
    if (remaining <= 0) break;

    const levelItems = states.filter(
      (s) => s.analysis.level === level && s.stillOwed > 0
    );
    if (levelItems.length === 0) continue;

    const totalOwed = levelItems.reduce((sum, item) => sum + item.stillOwed, 0);
    const pool = Math.min(remaining, totalOwed);

    if (level === 0) {
      const poolRemaining = allocateLevel0Pool(
        levelItems,
        pool,
        stateById,
        allocations,
        levelPools
      );
      remaining -= pool - poolRemaining;
      continue;
    }

    if (level === 1) {
      const poolRemaining = allocateLevel1Pool(
        levelItems,
        pool,
        stateById,
        allocations,
        levelPools
      );
      remaining -= pool - poolRemaining;
      continue;
    }

    const levelAlloc = allocateProportionally(levelItems, pool);

    for (const [debtId, amount] of levelAlloc) {
      const state = stateById.get(debtId);
      if (!state) continue;
      remaining -= applyAllocationToState(state, amount, allocations, levelPools);
    }
  }

  return remaining;
}

/**
 * Sestaví seřazená doporučení plateb s lokalizovaným vysvětlením.
 *
 * @param levelPools — součty alokací podle úrovně (počítané při alokaci)
 */
function buildRecommendations(
  states: AllocationState[],
  allocations: Map<string, number>,
  levelPools: ReadonlyMap<PriorityLevel, number>,
  locale: Locale
): PaymentRecommendation[] {
  const recommendations: PaymentRecommendation[] = [];

  for (const state of states) {
    const allocated = allocations.get(state.debtId) ?? 0;
    if (allocated <= 0) continue;

    const levelPool = levelPools.get(state.analysis.level) ?? allocated;
    const sharePercent = levelPool > 0 ? (allocated / levelPool) * 100 : 100;

    recommendations.push({
      debtId: state.debtId,
      creditor: state.analysis.debt.creditor,
      recommendedAmount: allocated,
      priority: state.analysis.urgencyScore,
      priorityLevel: state.analysis.level,
      reason: buildShortReason(state.analysis, locale),
      explanation: buildExplanation(
        state.analysis,
        allocated,
        sharePercent,
        locale
      ),
      category: state.analysis.debt.category,
    });
  }

  recommendations.sort((a, b) => {
    if (a.priorityLevel !== b.priorityLevel) {
      return a.priorityLevel - b.priorityLevel;
    }
    return b.priority - a.priority;
  });

  return recommendations;
}

interface WarningScan {
  unpaidCount: number;
  criticalUnpaidCount: number;
  hasUnderpaidExecutionRisk: boolean;
}

/** Jeden průchod stavů pro všechna varování kromě buffer zpráv. */
function scanStatesForWarnings(
  states: readonly AllocationState[],
  allocations: ReadonlyMap<string, number>
): WarningScan {
  let unpaidCount = 0;
  let criticalUnpaidCount = 0;
  let hasUnderpaidExecutionRisk = false;

  for (const state of states) {
    if (state.stillOwed <= 0) continue;

    unpaidCount += 1;
    if (state.analysis.level === 0) criticalUnpaidCount += 1;

    if (
      !hasUnderpaidExecutionRisk &&
      isExecutionRisk(state.analysis.debt)
    ) {
      const paid = allocations.get(state.debtId) ?? 0;
      if (paid < state.analysis.debt.amount * 0.5) {
        hasUnderpaidExecutionRisk = true;
      }
    }
  }

  return { unpaidCount, criticalUnpaidCount, hasUnderpaidExecutionRisk };
}

function collectWarnings(
  scan: WarningScan,
  ctx: {
    locale: Locale;
    availableFunds: number;
    lifeBuffer: number;
    totalAllocated: number;
    recommendationCount: number;
  }
): string[] {
  const warnings: string[] = [];
  const { locale, availableFunds, lifeBuffer, totalAllocated, recommendationCount } =
    ctx;
  const { unpaidCount, criticalUnpaidCount, hasUnderpaidExecutionRisk } = scan;

  if (unpaidCount > 0) {
    warnings.push(msgUnpaid(unpaidCount, locale));
  }

  if (criticalUnpaidCount >= 2) {
    warnings.push(msgMultipleCritical(criticalUnpaidCount, locale));
  }

  if (hasUnderpaidExecutionRisk) {
    warnings.push(msgExecutionRisk(locale));
  }

  if (recommendationCount > 0 && lifeBuffer > 0) {
    warnings.push(msgBufferPreserved(lifeBuffer, locale));
  }

  if (totalAllocated >= availableFunds * 0.95 && unpaidCount > 0) {
    warnings.push(msgFundsTight(locale));
  }

  return warnings;
}

// ─── Hlavní engine ─────────────────────────────────────────────────────────

/**
 * Spustí Priority Engine a vrátí kompletní doporučení plateb.
 *
 * @param profile — finanční profil uživatele (sanitizuje se na vstupu)
 * @param locale — jazyk vysvětlení (cs | ru | en)
 * @param today — referenční datum (testovatelné)
 */
export function runPriorityEngine(
  profile: FinancialProfile,
  locale: Locale = "cs",
  today: Date = new Date()
): PrioritizationResult {
  // ── Fáze 1: sanitizace vstupu ──
  const safeProfile = sanitizeProfile(profile);
  const availableFunds = safeProfile.availableFunds;

  // ── Fáze 2: prázdný profil ──
  if (safeProfile.debts.length === 0) {
    const cashFlow = buildProEngineCashFlowContext(safeProfile, today);
    const bufferPercent = resolveLifeBufferPercent(safeProfile.incomeStability, {
      hasLevel0Debt: false,
      availableFunds,
      cashFlow,
    });
    const lifeBuffer = resolveLifeBufferAmount(
      availableFunds,
      bufferPercent,
      cashFlow,
      cashFlow.planningAvailableFunds
    );
    const result = emptyResult(availableFunds, lifeBuffer, bufferPercent, locale);
    result.warnings = collectProCashFlowWarnings(cashFlow, locale);
    return attachProMetadata(result, cashFlow);
  }

  // ── Fáze 3: nulové prostředky ──
  if (availableFunds <= 0) {
    return zeroFundsResult(locale);
  }

  // ── Fáze 4: Pro cash flow (recurring income/expense, 2-month forecast) ──
  const cashFlow = buildProEngineCashFlowContext(safeProfile, today);
  const planningFunds = cashFlow.planningAvailableFunds;

  // ── Fáze 5: analýza dluhů s cash-flow kontextem ──
  const analyses = safeProfile.debts.map((debt) =>
    analyzeDebt(debt, today, { cashFlow })
  );
  const level0Debts = analyses.filter((analysis) => analysis.level === 0);
  const hasLevel0Debt = level0Debts.length > 0;
  const level0Count = level0Debts.length;

  // ── Fáze 6: life buffer (percent from planning funds, capped at actual balance) ──
  const bufferPercent = resolveLifeBufferPercent(safeProfile.incomeStability, {
    hasLevel0Debt,
    availableFunds: safeProfile.availableFunds,
    level0Count,
    cashFlow,
  });
  const lifeBuffer = resolveLifeBufferAmount(
    availableFunds,
    bufferPercent,
    cashFlow,
    planningFunds
  );
  let spendableStart = Math.max(0, availableFunds - lifeBuffer);
  spendableStart = applyDeficitSpendableGuard(spendableStart, cashFlow);

  const emergencyBuffer = isEmergencyBufferMode(
    hasLevel0Debt,
    level0Count,
    availableFunds
  );

  const bufferWarnings = needsReducedBuffer(hasLevel0Debt, availableFunds)
    ? [
        emergencyBuffer
          ? msgEmergencyBuffer(lifeBuffer, bufferPercent, locale)
          : msgReducedBuffer(lifeBuffer, bufferPercent, locale),
      ]
    : [msgLifeBuffer(lifeBuffer, bufferPercent, locale)];

  // ── Fáze 6: alokace ──
  const states = buildAllocationStates(analyses);
  const stateById = indexStatesById(states);
  const allocations = new Map<string, number>();
  const levelPools = new Map<PriorityLevel, number>();

  const spendableAfterMin = applyMinimumPayments(
    states,
    allocations,
    levelPools,
    spendableStart
  );
  applyProportionalByLevel(
    states,
    stateById,
    allocations,
    levelPools,
    spendableAfterMin
  );

  // ── Fáze 7: doporučení ──
  const recommendations = buildRecommendations(
    states,
    allocations,
    levelPools,
    locale
  );
  const totalAllocated = sumRecommendationAmounts(recommendations);

  // ── Fáze 8: varování a souhrn ──
  const warningScan = scanStatesForWarnings(states, allocations);
  const warnings = [
    ...bufferWarnings,
    ...collectProCashFlowWarnings(cashFlow, locale),
    ...collectWarnings(warningScan, {
      locale,
      availableFunds,
      lifeBuffer,
      totalAllocated,
      recommendationCount: recommendations.length,
    }),
  ];

  const top = recommendations[0];
  const summary = top
    ? msgSummary(top, lifeBuffer, recommendations, locale)
    : msgNoAllocation(locale);

  return attachProMetadata(
    {
      recommendations,
      totalAllocated,
      remainingFunds: roundMoney(Math.max(0, availableFunds - totalAllocated)),
      lifeBuffer,
      lifeBufferPercent: bufferPercent,
      spendableFunds: spendableStart,
      summary,
      warnings,
    },
    cashFlow
  );
}

// ─── Lokalizované zprávy ───────────────────────────────────────────────────

function sumRecommendationAmounts(
  recommendations: readonly PaymentRecommendation[]
): number {
  return roundMoney(
    recommendations.reduce((sum, rec) => sum + rec.recommendedAmount, 0)
  );
}

function emptyResult(
  available: number,
  buffer: number,
  percent: number,
  locale: Locale
): PrioritizationResult {
  const summary =
    locale === "cs"
      ? "Zatím nemáme žádné dluhy k prioritizaci."
      : locale === "ru"
        ? "Пока нет долгов для приоритизации."
        : "No debts to prioritize yet.";

  return {
    recommendations: [],
    totalAllocated: 0,
    remainingFunds: available,
    lifeBuffer: buffer,
    lifeBufferPercent: percent,
    spendableFunds: Math.max(0, available - buffer),
    summary,
    warnings: [],
  };
}

function zeroFundsResult(locale: Locale): PrioritizationResult {
  const warnings = [msgNoFunds(locale), msgNoFundsDetail(locale)];

  return {
    recommendations: [],
    totalAllocated: 0,
    remainingFunds: 0,
    lifeBuffer: 0,
    lifeBufferPercent: 0,
    spendableFunds: 0,
    summary: msgNoFunds(locale),
    warnings,
  };
}

function msgLifeBuffer(
  amount: number,
  percent: number,
  locale: Locale
): string {
  const pct = Math.round(percent * 100);
  if (locale === "cs")
    return `Rezerva na životní náklady: ${formatMoney(amount, locale)} (${pct} % z volných prostředků).`;
  if (locale === "ru")
    return `Резерв на жизнь: ${formatMoney(amount, locale)} (${pct} % от свободных средств).`;
  return `Life buffer reserved: ${formatMoney(amount, locale)} (${pct}% of available funds).`;
}

function msgReducedBuffer(
  amount: number,
  percent: number,
  locale: Locale
): string {
  const pct = Math.round(percent * 100);
  if (locale === "cs")
    return `⚠ Kritické závazky a nízké prostředky — rezerva snížena na ${formatMoney(amount, locale)} (${pct} %, standardně 20–35 %).`;
  if (locale === "ru")
    return `⚠ Критические долги и мало средств — резерв снижен до ${formatMoney(amount, locale)} (${pct} %, обычно 20–35 %).`;
  return `⚠ Critical debts with low funds — buffer reduced to ${formatMoney(amount, locale)} (${pct}%, normally 20–35%).`;
}

function msgEmergencyBuffer(
  amount: number,
  percent: number,
  locale: Locale
): string {
  const pct = Math.round(percent * 100);
  if (locale === "cs")
    return `⚠ Emergency režim — ${level0CountLabel(locale)} kritické závazky, rezerva pouze ${formatMoney(amount, locale)} (${pct} %).`;
  if (locale === "ru")
    return `⚠ Emergency режим — несколько критических долгов, резерв только ${formatMoney(amount, locale)} (${pct} %).`;
  return `⚠ Emergency mode — multiple critical debts, buffer only ${formatMoney(amount, locale)} (${pct}%).`;
}

function level0CountLabel(locale: Locale): string {
  if (locale === "cs") return "více";
  if (locale === "ru") return "несколько";
  return "multiple";
}

function msgNoFunds(locale: Locale): string {
  if (locale === "cs")
    return "Nemáte volné prostředky k rozdělení.";
  if (locale === "ru")
    return "Нет свободных средств для распределения.";
  return "No available funds to allocate.";
}

function msgNoFundsDetail(locale: Locale): string {
  if (locale === "cs")
    return "Doporučení: jednejte s věřiteli o splátkovém kalendáři nebo odkladu, případně vyhledejte poradenství v oblasti oddlužení.";
  if (locale === "ru")
    return "Рекомендация: договоритесь с кредиторами о графике платежей или отсрочке, при необходимости обратитесь за консультацией по реструктуризации долгов.";
  return "Recommendation: negotiate a payment schedule or deferral with creditors, or seek debt counselling.";
}

function msgUnpaid(count: number, locale: Locale): string {
  if (locale === "cs")
    return `⚠ ${count} závazek(ů) zůstává nepokrytých — prostředky nestačí ani po rezervě.`;
  if (locale === "ru")
    return `⚠ ${count} обязательств остаётся непокрытыми — средств не хватает даже после резерва.`;
  return `⚠ ${count} obligation(s) remain uncovered — insufficient funds after buffer.`;
}

function msgBufferPreserved(amount: number, locale: Locale): string {
  if (locale === "cs")
    return `Rezerva ${formatMoney(amount, locale)} je chráněna pro jídlo, dopravu a nezbytné výdaje.`;
  if (locale === "ru")
    return `Резерв ${formatMoney(amount, locale)} защищён на еду, транспорт и базовые расходы.`;
  return `Buffer of ${formatMoney(amount, locale)} is protected for food, transport, and essentials.`;
}

function msgFundsTight(locale: Locale): string {
  if (locale === "cs")
    return "⚠ Volné prostředky jsou téměř vyčerpány — zvažte snížení neesenciálních výdajů.";
  if (locale === "ru")
    return "⚠ Свободные средства почти исчерпаны — рассмотрите сокращение необязательных расходов.";
  return "⚠ Available funds are nearly exhausted — consider cutting non-essential spending.";
}

function msgSummary(
  top: PaymentRecommendation,
  lifeBuffer: number,
  recommendations: readonly PaymentRecommendation[],
  locale: Locale
): string {
  const paymentCount = recommendations.length;
  const totalAllocated = sumRecommendationAmounts(recommendations);

  if (locale === "cs") {
    return `Priorita: ${top.creditor} — ${formatMoney(top.recommendedAmount, locale)} (úroveň ${top.priorityLevel}). Celkem ${paymentCount} plateb, alokováno ${formatMoney(totalAllocated, locale)}. Rezerva ${formatMoney(lifeBuffer, locale)} zůstává na život.`;
  }
  if (locale === "ru") {
    return `Приоритет: ${top.creditor} — ${formatMoney(top.recommendedAmount, locale)} (уровень ${top.priorityLevel}). Всего ${paymentCount} платежей, выделено ${formatMoney(totalAllocated, locale)}. Резерв ${formatMoney(lifeBuffer, locale)} остаётся на жизнь.`;
  }
  return `Priority: ${top.creditor} — ${formatMoney(top.recommendedAmount, locale)} (level ${top.priorityLevel}). ${paymentCount} payment(s), ${formatMoney(totalAllocated, locale)} allocated. Buffer ${formatMoney(lifeBuffer, locale)} kept for living costs.`;
}

function msgNoAllocation(locale: Locale): string {
  if (locale === "cs")
    return "Nepodařilo se vytvořit doporučení — zkontrolujte částky a termíny závazků.";
  if (locale === "ru")
    return "Не удалось сформировать рекомендацию — проверьте суммы и сроки обязательств.";
  return "Could not generate recommendation — check debt amounts and deadlines.";
}

function msgMultipleCritical(count: number, locale: Locale): string {
  if (locale === "cs")
    return `⚠ ${count} kritických závazků — prostředky nestačí na všechny. Zvažte jednání s věřiteli.`;
  if (locale === "ru")
    return `⚠ ${count} критических обязательств — средств не хватает на все. Обратитесь к кредиторам.`;
  return `⚠ ${count} critical obligations — funds won't cover all. Consider negotiating with creditors.`;
}

function collectProCashFlowWarnings(
  cashFlow: ProEngineCashFlowContext,
  locale: Locale
): string[] {
  const warnings: string[] = [];

  if (
    cashFlow.incomeFromRecurring ||
    cashFlow.expensesFromRecurring ||
    cashFlow.monthlyIncome > 0 ||
    cashFlow.monthlyExpenses > 0
  ) {
    if (cashFlow.netMonthlyCashFlow < 0) {
      warnings.push(msgNegativeCashFlow(cashFlow.netMonthlyCashFlow, locale));
    }

    if (cashFlow.projectedDeficitMonthIndex !== null) {
      const forecastMonth =
        cashFlow.shortTermForecast[cashFlow.projectedDeficitMonthIndex];
      warnings.push(
        msgForecastDeficit(
          cashFlow.projectedDeficitMonthIndex,
          forecastMonth?.endingBalance ?? 0,
          locale
        )
      );
    }

    if (
      cashFlow.effectiveStability !== undefined &&
      cashFlow.netMonthlyCashFlow < 0
    ) {
      warnings.push(msgEffectiveStability(cashFlow.effectiveStability, locale));
    }
  }

  return warnings;
}

/** Attach Pro recurring metadata when catalog data is present. */
function attachProMetadata(
  result: PrioritizationResult,
  cashFlow: ProEngineCashFlowContext
): PrioritizationResult {
  if (!cashFlow.incomeFromRecurring && !cashFlow.expensesFromRecurring) {
    return result;
  }

  return {
    ...result,
    monthlyRecurringIncome: cashFlow.monthlyRecurringIncome,
    monthlyRecurringExpense: cashFlow.monthlyRecurringExpense,
    planningAvailableFunds: cashFlow.planningAvailableFunds,
    shortTermForecast: cashFlow.shortTermForecast.map((month) => ({
      monthIndex: month.index,
      yearMonth: month.yearMonth,
      endingBalance: month.endingBalance,
    })),
  };
}

function msgNegativeCashFlow(net: number, locale: Locale): string {
  const amount = formatMoney(Math.abs(net), locale);
  if (locale === "cs")
    return `⚠ Měsíční cash flow je záporný (−${amount}) — alokace omezena, prioritizujte kritické dluhy.`;
  if (locale === "ru")
    return `⚠ Месячный cash flow отрицательный (−${amount}) — аллокация ограничена, приоритет критическим долгам.`;
  return `⚠ Monthly cash flow is negative (−${amount}) — allocation reduced; prioritize critical debts.`;
}

function msgForecastDeficit(
  monthIndex: number,
  deficitAmount: number,
  locale: Locale
): string {
  const monthNum = monthIndex + 1;
  const amount = formatMoney(Math.abs(deficitAmount), locale);
  if (locale === "cs")
    return `⚠ Prognóza: deficit ${amount} do ${monthNum}. měsíce — zvažte snížení výdajů nebo navýšení příjmů.`;
  if (locale === "ru")
    return `⚠ Прогноз: дефицит ${amount} к ${monthNum}-му месяцу — сократите расходы или увеличьте доходы.`;
  return `⚠ Forecast: deficit of ${amount} by month ${monthNum} — reduce expenses or increase income.`;
}

function msgEffectiveStability(
  stability: IncomeStability,
  locale: Locale
): string {
  if (locale === "cs")
    return `Rezerva navýšena dle efektivní stability příjmu (${stability}) a záporného cash flow.`;
  if (locale === "ru")
    return `Резерв увеличен с учётом эффективной стабильности дохода (${stability}) и отрицательного cash flow.`;
  return `Buffer increased using effective income stability (${stability}) and negative cash flow.`;
}

function msgExecutionRisk(locale: Locale): string {
  if (locale === "cs")
    return "⚠ Exekuce, daně nebo pokuty — doporučujeme právní konzultaci a prioritu této platby.";
  if (locale === "ru")
    return "⚠ Исполнительное производство, налоги или штрафы — рекомендуем юридическую консультацию и приоритет этого платежа.";
  return "⚠ Enforcement, taxes or fines — seek legal advice and prioritize this payment.";
}
