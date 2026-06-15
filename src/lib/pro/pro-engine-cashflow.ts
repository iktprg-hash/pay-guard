import { amountToMonthlyEquivalent } from "@/lib/financial/recurring-utils";
import type {
  FinancialProfile,
  Frequency,
  IncomeStability,
  UserFinancialProfile,
} from "@/lib/types/financial";
import { toFinancialProfile } from "@/lib/types/financial";

export const PRO_ENGINE_FORECAST_MONTHS = 3;

export interface ProEngineForecastMonth {
  index: number;
  yearMonth: string;
  endingBalance: number;
}

/** Resolved monthly cash flow used by Priority Engine (Pro-aware). */
export interface ProEngineCashFlowContext {
  monthlyIncome: number;
  monthlyExpenses: number;
  minimumDebtPayments: number;
  netMonthlyCashFlow: number;
  incomeFromRecurring: boolean;
  expensesFromRecurring: boolean;
  /** Stability adjusted when recurring data signals pressure. */
  effectiveStability: IncomeStability | undefined;
  /** Minimum buffer amount from ~2 weeks of recurring expenses. */
  expenseBasedMinBuffer: number;
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

  const forecastMonths = hasCashFlowSignal
    ? buildSimpleForecast(
        profile.availableFunds,
        netMonthlyCashFlow,
        PRO_ENGINE_FORECAST_MONTHS,
        now
      )
    : [];

  const projectedDeficitMonthIndex = hasCashFlowSignal
    ? forecastMonths.find((m) => m.endingBalance < 0)?.index ?? null
    : null;

  return {
    monthlyIncome,
    monthlyExpenses,
    minimumDebtPayments,
    netMonthlyCashFlow,
    incomeFromRecurring,
    expensesFromRecurring,
    effectiveStability,
    expenseBasedMinBuffer,
    forecastMonths,
    projectedDeficitMonthIndex,
  };
}

/** Full Pro user profile → engine-ready {@link FinancialProfile}. */
export function buildEngineProfileFromUser(
  profile: UserFinancialProfile
): FinancialProfile {
  return toFinancialProfile(profile);
}
