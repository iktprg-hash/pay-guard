/**
 * Pay Guard — financial domain types (Free chat + Pro cloud profile).
 * Amounts are stored in profile currency (Czech market default: CZK).
 */

import { mergeDebts } from "@/lib/financial/mergeDebts";
import { DEBT_CATEGORIES, type DebtCategory } from "@/lib/types/debt-constants";

export type { DebtCategory };
export { DEBT_CATEGORIES };

// ---------------------------------------------------------------------------
// Enums & unions
// ---------------------------------------------------------------------------

/** Debt / obligation category — affects Priority Engine weighting */
// DebtCategory is defined in debt-constants.ts and re-exported above.

/** Recurring expense category preset (Pro budget tracking) */
export type ExpenseCategoryPreset =
  | "housing"
  | "utilities"
  | "food"
  | "transport"
  | "communication"
  | "health"
  | "entertainment"
  | "subscriptions"
  | "shopping"
  | "education"
  | "insurance"
  | "childcare"
  | "other";

/** Stored category slug — preset or custom (e.g. custom:pet-care) */
export type ExpenseCategory = string;

/** Recurring income category preset */
export type IncomeCategoryPreset =
  | "salary"
  | "freelance"
  | "rental"
  | "benefits"
  | "investments"
  | "other";

/** Stored income category slug — preset or custom */
export type IncomeCategory = string;

/** Recurrence interval for incomes, expenses, and recurring debts */
export type Frequency = "monthly" | "weekly" | "biweekly" | "one_time";

/** App subscription tier */
export type SubscriptionTier = "free" | "pro" | "pro_max";

/**
 * Profile display / storage currency.
 * CZK is canonical for the Czech market; RUB may appear when normalizing user input.
 */
export type AppCurrency = "CZK" | "RUB";

/** Income stability — used by Priority Engine life-buffer logic */
export type IncomeStability = "stable" | "variable" | "uncertain";

/**
 * Payment priority level (Priority Engine)
 * 0 = critical, 1 = high, 2 = medium, 3 = low
 */
export type PriorityLevel = 0 | 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Constants (single source of truth for validation & UI)
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORY_PRESETS = [
  "housing",
  "utilities",
  "food",
  "transport",
  "communication",
  "health",
  "entertainment",
  "subscriptions",
  "shopping",
  "education",
  "insurance",
  "childcare",
  "other",
] as const satisfies readonly ExpenseCategoryPreset[];

/** @deprecated Use EXPENSE_CATEGORY_PRESETS */
export const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_PRESETS;

export const INCOME_CATEGORY_PRESETS = [
  "salary",
  "freelance",
  "rental",
  "benefits",
  "investments",
  "other",
] as const satisfies readonly IncomeCategoryPreset[];

export const FREQUENCIES = [
  "monthly",
  "weekly",
  "biweekly",
  "one_time",
] as const satisfies readonly Frequency[];

export const SUBSCRIPTION_TIERS = [
  "free",
  "pro",
  "pro_max",
] as const satisfies readonly SubscriptionTier[];

export const APP_CURRENCIES = ["CZK", "RUB"] as const satisfies readonly AppCurrency[];

/** Default currency for new profiles (Czech market) */
export const DEFAULT_APP_CURRENCY: AppCurrency = "CZK";

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

/** Debt / obligation */
export interface Debt {
  id: string;
  creditor: string;
  amount: number;
  minimumPayment?: number;
  dueDate?: string;
  criticalDate?: string;
  criticalNote?: string;
  category: DebtCategory;
  interestRate?: number;
  /** Pro: recurring obligation (e.g. monthly subscription debt) */
  isRecurring?: boolean;
  frequency?: Frequency;
  notes?: string;
  /** ISO 8601 — set when persisted in Pro cloud */
  createdAt?: string;
  updatedAt?: string;
}

/** Recurring income (Pro) */
export interface RecurringIncome {
  id: string;
  source: string;
  amount: number;
  frequency: Frequency;
  /** Preset slug or custom:your-label */
  category: IncomeCategory;
  /** Next expected payment date (ISO date YYYY-MM-DD) */
  nextDate: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Recurring expense (Pro) */
export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  category: ExpenseCategory;
  /** Next expected payment date (ISO date YYYY-MM-DD) */
  nextDate: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/**
 * Lightweight profile for chat, manual entry, and Priority Engine.
 * Kept backward-compatible with existing API routes and local storage.
 */
export interface FinancialProfile {
  availableFunds: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  incomeStability?: IncomeStability;
  debts: Debt[];
}

/**
 * Full persisted financial profile (Pro cloud sync).
 * Extends chat profile data with recurring cashflow and subscription metadata.
 */
export interface UserFinancialProfile {
  userId: string;
  availableFunds: number;
  currency: AppCurrency;
  debts: Debt[];
  recurringIncomes: RecurringIncome[];
  recurringExpenses: RecurringExpense[];
  /** Aggregate monthly income (optional snapshot for engine / UI) */
  monthlyIncome?: number;
  /** Aggregate monthly expenses (optional snapshot for engine / UI) */
  monthlyExpenses?: number;
  incomeStability?: IncomeStability;
  lastUpdated: string;
  subscriptionTier: SubscriptionTier;
  /** ISO expiry from Stripe / profiles.subscription_expires_at */
  subscriptionExpiresAt?: string | null;
}

/** Partial update for Pro profile sync (API / webhook) */
export type UserFinancialProfileUpdate = Partial<
  Omit<UserFinancialProfile, "userId" | "lastUpdated">
> & {
  lastUpdated?: string;
};

// ---------------------------------------------------------------------------
// Priority Engine output
// ---------------------------------------------------------------------------

/** Recommended payment allocation */
export interface PaymentRecommendation {
  debtId: string;
  creditor: string;
  recommendedAmount: number;
  /** Urgency score (higher = more important) */
  priority: number;
  /** Level 0–3 for UI and logic */
  priorityLevel: PriorityLevel;
  reason: string;
  explanation: string;
  category: DebtCategory;
}

/** Result of the prioritization algorithm */
export interface PrioritizationResult {
  recommendations: PaymentRecommendation[];
  totalAllocated: number;
  remainingFunds: number;
  /** Reserve for living costs (food, transport, etc.) */
  lifeBuffer: number;
  /** Reserve percentage (typically 0.20–0.35) */
  lifeBufferPercent: number;
  /** Funds available to allocate across creditors */
  spendableFunds: number;
  summary: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** Chat message with optional embedded recommendation */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  recommendation?: PrioritizationResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === "pro" || tier === "pro_max";
}

/** Build an empty Pro profile for a user */
export function createEmptyUserFinancialProfile(
  userId: string,
  tier: SubscriptionTier = "free"
): UserFinancialProfile {
  const now = new Date().toISOString();
  return {
    userId,
    availableFunds: 0,
    currency: DEFAULT_APP_CURRENCY,
    debts: [],
    recurringIncomes: [],
    recurringExpenses: [],
    lastUpdated: now,
    subscriptionTier: tier,
  };
}

/** Map full Pro profile → lightweight engine/chat profile */
export function toFinancialProfile(
  profile: UserFinancialProfile
): FinancialProfile {
  return {
    availableFunds: profile.availableFunds,
    monthlyIncome: profile.monthlyIncome,
    monthlyExpenses: profile.monthlyExpenses,
    incomeStability: profile.incomeStability,
    debts: profile.debts,
  };
}

/** Merge UserFinancialProfile fields into an existing FinancialProfile shape */
export function mergeFinancialProfiles(
  base: FinancialProfile,
  pro: Pick<
    UserFinancialProfile,
    | "availableFunds"
    | "monthlyIncome"
    | "monthlyExpenses"
    | "incomeStability"
    | "debts"
    | "recurringIncomes"
    | "recurringExpenses"
  >
): FinancialProfile & {
  recurringIncomes?: RecurringIncome[];
  recurringExpenses?: RecurringExpense[];
} {
  return {
    ...base,
    availableFunds: pro.availableFunds ?? base.availableFunds,
    monthlyIncome: pro.monthlyIncome ?? base.monthlyIncome,
    monthlyExpenses: pro.monthlyExpenses ?? base.monthlyExpenses,
    incomeStability: pro.incomeStability ?? base.incomeStability,
    debts: pro.debts.length > 0 ? pro.debts : base.debts,
    recurringIncomes: pro.recurringIncomes,
    recurringExpenses: pro.recurringExpenses,
  };
}

/**
 * Merge a partial profile update into the current chat/engine profile.
 * Debts are merged by creditor/id — not replaced wholesale (Grok chat updates).
 */
export function mergeProfileUpdate(
  current: FinancialProfile,
  update: Partial<FinancialProfile>
): FinancialProfile {
  return {
    availableFunds: update.availableFunds ?? current.availableFunds,
    monthlyIncome: update.monthlyIncome ?? current.monthlyIncome,
    monthlyExpenses: update.monthlyExpenses ?? current.monthlyExpenses,
    incomeStability: update.incomeStability ?? current.incomeStability,
    debts:
      update.debts && update.debts.length > 0
        ? mergeDebts(current.debts, update.debts)
        : current.debts,
  };
}
