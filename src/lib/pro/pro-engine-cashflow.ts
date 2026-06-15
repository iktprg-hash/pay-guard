import { amountToMonthlyEquivalent } from "@/lib/financial/recurring-utils";
import type {
  FinancialProfile,
  Frequency,
  IncomeStability,
  UserFinancialProfile,
} from "@/lib/types/financial";
import { toFinancialProfile } from "@/lib/types/financial";

/** Aggregated Pro cash-flow metrics shared by summary, forecast, and Priority Engine. */
export interface ProSummaryCashFlowMetrics {
  /** Sum of recurring income catalog (monthly equivalent). */
  monthlyRecurringIncome: number;
  /** Sum of recurring expense catalog (monthly equivalent). */
  monthlyRecurringExpense: number;
  /** Income used by engine: recurring catalog preferred over session snapshot. */
  resolvedMonthlyIncome: number;
  /** Expenses used by engine: recurring catalog preferred over session snapshot. */
  resolvedMonthlyExpenses: number;
  /** Sum of minimum debt payments (or full balance when min is unset). */
  minimumDebtPayments: number;
  /** Real monthly cash flow: income − expenses − minimum debt payments. */
  netMonthlyCashFlow: number;
  /** Declared stability adjusted when net cash flow is negative. */
  effectiveIncomeStability: IncomeStability | undefined;
  /** First forecast month (0-based) where balance drops below zero. */
  projectedDeficitMonthIndex: number | null;
  /** 1–2 month ending-balance projection (same formula as Priority Engine). */
  shortTermForecast: ProEngineForecastMonth[];
  /** Funds after recurring inflow/outflow adjustment. */
  planningAvailableFunds: number;
  /** True when recurring or snapshot income/expense data exists. */
  hasCashFlowSignal: boolean;
}

/** Engine uses a 2-month horizon for short-term planning and warnings. */
export const SHORT_TERM_FORECAST_MONTHS = 2;

/** Life buffer floor as % of monthly cash flow (stable / variable / uncertain). */
export const CASH_FLOW_BUFFER_PERCENT = {
  stable: 0.2,
  variable: 0.25,
  uncertain: 0.3,
} as const;

export interface ProEngineForecastMonth {
  index: number;
  yearMonth: string;
  endingBalance: number;
}

/** Resolved monthly cash flow used by Priority Engine (Pro-aware). */
export interface ProEngineCashFlowContext {
  /** Recurring income catalog total (monthly equivalent). */
  monthlyRecurringIncome: number;
  /** Recurring expense catalog total (monthly equivalent). */
  monthlyRecurringExpense: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  minimumDebtPayments: number;
  netMonthlyCashFlow: number;
  incomeFromRecurring: boolean;
  expensesFromRecurring: boolean;
  /** Stability adjusted when recurring data signals pressure. */
  effectiveStability: IncomeStability | undefined;
  /** Minimum buffer from ~2 weeks of recurring expenses. */
  expenseBasedMinBuffer: number;
  /** Minimum buffer: 20–30% of monthly cash flow (stability-based). */
  cashFlowBasedMinBuffer: number;
  /** Available funds adjusted by recurring inflow/outflow before allocation. */
  planningAvailableFunds: number;
  /** 1–2 month ending-balance projection. */
  shortTermForecast: ProEngineForecastMonth[];
  /** @deprecated Use shortTermForecast — kept for compatibility. */
  forecastMonths: ProEngineForecastMonth[];
  /** First month index (0-based) where balance drops below zero, if any. */
  projectedDeficitMonthIndex: number | null;
}

function sumRecurringMonthly<T extends { amount: number; frequency: Frequency }>(
  items: T[]
): number {
  return items.reduce(
    (sum, item) => sum + amountToMonthlyEquivalent(item.amount, item.frequency),
    0
  );
}

function sumMinimumDebtPayments(debts: FinancialProfile["debts"]): number {
  return debts.reduce(
    (sum, debt) => sum + (debt.minimumPayment ?? debt.amount),
    0
  );
}

function yearMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(base: Date, offset: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

/**
 * Infer buffer stability: negative net cash flow downgrades stable → variable,
 * severe deficit downgrades variable → uncertain.
 */
export function inferEffectiveStability(
  declared: IncomeStability | undefined,
  monthlyIncome: number,
  netMonthlyCashFlow: number
): IncomeStability | undefined {
  if (!declared && monthlyIncome <= 0) return undefined;
  const base = declared ?? "stable";

  if (netMonthlyCashFlow >= 0) return base;

  const deficitRatio =
    monthlyIncome > 0 ? Math.abs(netMonthlyCashFlow) / monthlyIncome : 1;

  if (base === "stable" && deficitRatio > 0.05) return "variable";
  if (base === "variable" && deficitRatio > 0.2) return "uncertain";
  if (base === "stable" && deficitRatio > 0.2) return "uncertain";

  return base;
}

function buildSimpleForecast(
  startingBalance: number,
  netMonthlyChange: number,
  monthCount: number,
  now: Date
): ProEngineForecastMonth[] {
  const months: ProEngineForecastMonth[] = [];
  let balance = startingBalance;

  for (let i = 0; i < monthCount; i++) {
    balance += netMonthlyChange;
    months.push({
      index: i,
      yearMonth: yearMonthKey(addMonths(now, i)),
      endingBalance: balance,
    });
  }

  return months;
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Base amount for the 20–30% cash-flow buffer floor.
 * Prefers positive net cash flow, then operating surplus, then gross income.
 */
export function resolveCashFlowBufferBase(
  cashFlow: Pick<
    ProEngineCashFlowContext,
    | "netMonthlyCashFlow"
    | "monthlyRecurringIncome"
    | "monthlyRecurringExpense"
    | "monthlyIncome"
    | "monthlyExpenses"
    | "incomeFromRecurring"
    | "expensesFromRecurring"
  >
): number {
  const operatingNet =
    cashFlow.incomeFromRecurring || cashFlow.expensesFromRecurring
      ? cashFlow.monthlyRecurringIncome - cashFlow.monthlyRecurringExpense
      : cashFlow.monthlyIncome - cashFlow.monthlyExpenses;

  if (cashFlow.netMonthlyCashFlow > 0) return cashFlow.netMonthlyCashFlow;
  if (operatingNet > 0) return operatingNet;
  if (cashFlow.monthlyIncome > 0) return cashFlow.monthlyIncome;
  return 0;
}

/**
 * Minimum life buffer from 20% (stable) / 25% (variable) / 30% (uncertain)
 * of average monthly cash flow when Pro recurring data is present.
 */
export function resolveCashFlowBasedMinBuffer(
  stability: IncomeStability | undefined,
  cashFlow: ProEngineCashFlowContext
): number {
  const hasSignal =
    cashFlow.incomeFromRecurring ||
    cashFlow.expensesFromRecurring ||
    cashFlow.monthlyIncome > 0 ||
    cashFlow.monthlyExpenses > 0;
  if (!hasSignal) return 0;

  const base = resolveCashFlowBufferBase(cashFlow);
  if (base <= 0) return 0;

  const effective = cashFlow.effectiveStability ?? stability ?? "stable";
  const percent =
    effective === "uncertain"
      ? CASH_FLOW_BUFFER_PERCENT.uncertain
      : effective === "variable"
        ? CASH_FLOW_BUFFER_PERCENT.variable
        : CASH_FLOW_BUFFER_PERCENT.stable;

  return roundMoney(base * percent);
}

/**
 * Adjusts available funds using explicit recurring income and expenses:
 * `available + (recurringIncome − recurringExpense)`, capped at `available + recurringIncome`.
 */
export function resolvePlanningAvailableFunds(
  availableFunds: number,
  cashFlow: Pick<
    ProEngineCashFlowContext,
    "monthlyRecurringIncome" | "monthlyRecurringExpense" | "incomeFromRecurring" | "expensesFromRecurring"
  >
): number {
  const funds = Math.max(0, availableFunds);
  const hasRecurring =
    cashFlow.incomeFromRecurring || cashFlow.expensesFromRecurring;
  if (!hasRecurring) return funds;

  const recurringNet =
    cashFlow.monthlyRecurringIncome - cashFlow.monthlyRecurringExpense;
  const adjusted = funds + recurringNet;
  const cap = funds + cashFlow.monthlyRecurringIncome;
  return roundMoney(Math.max(0, Math.min(adjusted, cap)));
}

/**
 * Build Pro cash-flow context from any engine profile (chat snapshot or Pro catalog).
 * Recurring incomes/expenses take precedence over monthlyIncome/monthlyExpenses snapshots.
 */
export function buildProEngineCashFlowContext(
  profile: FinancialProfile,
  now: Date = new Date()
): ProEngineCashFlowContext {
  const recurringIncomes = profile.recurringIncomes ?? [];
  const recurringExpenses = profile.recurringExpenses ?? [];

  const recurringIncomeMonthly = sumRecurringMonthly(recurringIncomes);
  const recurringExpenseMonthly = sumRecurringMonthly(recurringExpenses);

  const incomeFromRecurring = recurringIncomeMonthly > 0;
  const expensesFromRecurring = recurringExpenseMonthly > 0;

  const monthlyIncome = incomeFromRecurring
    ? recurringIncomeMonthly
    : profile.monthlyIncome ?? 0;
  const monthlyExpenses = expensesFromRecurring
    ? recurringExpenseMonthly
    : profile.monthlyExpenses ?? 0;

  const minimumDebtPayments = sumMinimumDebtPayments(profile.debts);

  const hasIncomeSignal =
    incomeFromRecurring || (profile.monthlyIncome ?? 0) > 0;
  const hasExpenseSignal =
    expensesFromRecurring || (profile.monthlyExpenses ?? 0) > 0;
  const hasCashFlowSignal = hasIncomeSignal || hasExpenseSignal;

  const netMonthlyCashFlow = hasCashFlowSignal
    ? monthlyIncome - monthlyExpenses - minimumDebtPayments
    : 0;

  const effectiveStability = hasCashFlowSignal
    ? inferEffectiveStability(
        profile.incomeStability,
        monthlyIncome,
        netMonthlyCashFlow
      )
    : profile.incomeStability;

  const expenseBasedMinBuffer = hasExpenseSignal
    ? (monthlyExpenses * 2) / 4.33
    : 0;

  const shortTermForecast = hasCashFlowSignal
    ? buildSimpleForecast(
        profile.availableFunds,
        netMonthlyCashFlow,
        SHORT_TERM_FORECAST_MONTHS,
        now
      )
    : [];

  const projectedDeficitMonthIndex = hasCashFlowSignal
    ? shortTermForecast.find((m) => m.endingBalance < 0)?.index ?? null
    : null;

  const planningAvailableFunds = resolvePlanningAvailableFunds(
    profile.availableFunds,
    {
      monthlyRecurringIncome: recurringIncomeMonthly,
      monthlyRecurringExpense: recurringExpenseMonthly,
      incomeFromRecurring,
      expensesFromRecurring,
    }
  );

  const partialContext: ProEngineCashFlowContext = {
    monthlyRecurringIncome: recurringIncomeMonthly,
    monthlyRecurringExpense: recurringExpenseMonthly,
    monthlyIncome,
    monthlyExpenses,
    minimumDebtPayments,
    netMonthlyCashFlow,
    incomeFromRecurring,
    expensesFromRecurring,
    effectiveStability,
    expenseBasedMinBuffer,
    cashFlowBasedMinBuffer: 0,
    planningAvailableFunds,
    shortTermForecast,
    forecastMonths: shortTermForecast,
    projectedDeficitMonthIndex,
  };

  const cashFlowBasedMinBuffer = resolveCashFlowBasedMinBuffer(
    profile.incomeStability,
    partialContext
  );

  return {
    ...partialContext,
    cashFlowBasedMinBuffer,
  };
}

/** Full Pro user profile → engine-ready {@link FinancialProfile}. */
export function buildEngineProfileFromUser(
  profile: UserFinancialProfile
): FinancialProfile {
  return toFinancialProfile(profile);
}

/**
 * Single source of truth for Pro dashboard, forecast, and Priority Engine cash flow.
 * Delegates net/buffer/forecast math to {@link buildProEngineCashFlowContext}.
 */
export function buildProSummaryCashFlowMetrics(
  profile: UserFinancialProfile | undefined,
  now: Date = new Date()
): ProSummaryCashFlowMetrics {
  const recurringIncomes = profile?.recurringIncomes ?? [];
  const recurringExpenses = profile?.recurringExpenses ?? [];

  const monthlyRecurringIncome = sumRecurringMonthly(recurringIncomes);
  const monthlyRecurringExpense = sumRecurringMonthly(recurringExpenses);

  const engineProfile: FinancialProfile = profile
    ? toFinancialProfile(profile)
    : { availableFunds: 0, debts: [] };

  const ctx = buildProEngineCashFlowContext(engineProfile, now);

  const hasCashFlowSignal =
    ctx.incomeFromRecurring ||
    ctx.expensesFromRecurring ||
    ctx.monthlyIncome > 0 ||
    ctx.monthlyExpenses > 0;

  return {
    monthlyRecurringIncome,
    monthlyRecurringExpense,
    resolvedMonthlyIncome: ctx.monthlyIncome,
    resolvedMonthlyExpenses: ctx.monthlyExpenses,
    minimumDebtPayments: ctx.minimumDebtPayments,
    netMonthlyCashFlow: ctx.netMonthlyCashFlow,
    effectiveIncomeStability: ctx.effectiveStability,
    projectedDeficitMonthIndex: ctx.projectedDeficitMonthIndex,
    shortTermForecast: ctx.shortTermForecast,
    planningAvailableFunds: ctx.planningAvailableFunds,
    hasCashFlowSignal,
  };
}
