/**
 * Pro financial data — browser/client Supabase service layer.
 * Uses @/lib/supabase/client (createBrowserClient via @supabase/ssr).
 * Equivalent to the deprecated createClientComponentClient() from auth-helpers-nextjs.
 *
 * RLS: all queries run as the signed-in user (auth.uid() = user_id).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { analyzeDebt } from "@/services/priorityEngine";
import type {
  AppCurrency,
  Debt,
  DebtCategory,
  ExpenseCategory,
  FinancialProfile,
  Frequency,
  PrioritizationResult,
  RecurringExpense,
  RecurringIncome,
  SubscriptionTier,
  UserFinancialProfile,
} from "@/lib/types/financial";
import {
  DEFAULT_APP_CURRENCY,
  createEmptyUserFinancialProfile,
} from "@/lib/types/financial";
import { ensureProAccess } from "@/lib/supabase/ensure-pro-access";

function guardProAccess(
  access: Awaited<ReturnType<typeof ensureProAccess>>
): ProResult<never> | null {
  if (access.ok) return null;
  return failure(access.error?.message ?? "Pro subscription required", access.error?.code);
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ProFinancialError {
  message: string;
  code?: string;
}

export type ProResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProFinancialError };

function success<T>(data: T): ProResult<T> {
  return { ok: true, data };
}

function failure(message: string, code?: string): ProResult<never> {
  return { ok: false, error: { message, code } };
}

function fromSupabaseError(
  err: { message: string; code?: string } | null,
  fallback: string
): ProResult<never> {
  if (!err) return failure(fallback, "unknown");
  return failure(err.message, err.code);
}

function getClient(): SupabaseClient {
  const client = createBrowserSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured");
  }
  return client;
}

export { ensureProAccess };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureUuid(id: string | undefined): string {
  if (id && UUID_RE.test(id)) return id;
  return crypto.randomUUID();
}

function parseDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Row mappers (DB snake_case → domain)
// ---------------------------------------------------------------------------

interface DebtRow {
  id: string;
  user_id: string;
  session_id: string | null;
  creditor_name: string;
  amount: number;
  due_date: string | null;
  critical_date: string | null;
  critical_note: string | null;
  category: string;
  priority_level: number | null;
  notes: string | null;
  minimum_payment: number | null;
  interest_rate: number | null;
  is_recurring: boolean | null;
  frequency: string | null;
  created_at: string;
  updated_at: string | null;
}

interface RecurringIncomeRow {
  id: string;
  user_id: string;
  source: string;
  amount: number;
  frequency: string;
  category: string;
  next_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

interface RecurringExpenseRow {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  next_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ProfileRow {
  currency: AppCurrency;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  financial_last_updated: string | null;
}

function debtRowToDomain(row: DebtRow): Debt {
  return {
    id: row.id,
    creditor: row.creditor_name,
    amount: Number(row.amount),
    minimumPayment: row.minimum_payment ?? undefined,
    dueDate: parseDateOnly(row.due_date),
    criticalDate: parseDateOnly(row.critical_date),
    criticalNote: row.critical_note ?? undefined,
    category: row.category as DebtCategory,
    interestRate: row.interest_rate ?? undefined,
    notes: row.notes ?? undefined,
    isRecurring: row.is_recurring ?? undefined,
    frequency: (row.frequency as Frequency | null) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function debtToRow(
  debt: Debt,
  userId: string,
  sessionId: string | null
): Record<string, unknown> {
  const { level } = analyzeDebt(debt);
  return {
    id: ensureUuid(debt.id),
    user_id: userId,
    session_id: sessionId,
    creditor_name: debt.creditor,
    amount: debt.amount,
    due_date: debt.dueDate?.slice(0, 10) ?? null,
    critical_date: debt.criticalDate?.slice(0, 10) ?? null,
    critical_note: debt.criticalNote ?? null,
    category: debt.category,
    priority_level: level,
    notes: debt.notes ?? null,
    minimum_payment: debt.minimumPayment ?? null,
    interest_rate: debt.interestRate ?? null,
    is_recurring: debt.isRecurring ?? false,
    frequency: debt.frequency ?? null,
    updated_at: new Date().toISOString(),
  };
}

function recurringIncomeToRow(
  income: RecurringIncome,
  userId: string
): Record<string, unknown> {
  return {
    id: ensureUuid(income.id),
    user_id: userId,
    source: income.source,
    amount: income.amount,
    frequency: income.frequency,
    category: income.category ?? "other",
    next_date: income.nextDate.slice(0, 10),
    notes: income.notes ?? null,
    updated_at: new Date().toISOString(),
  };
}

function recurringIncomeRowToDomain(row: RecurringIncomeRow): RecurringIncome {
  return {
    id: row.id,
    source: row.source,
    amount: Number(row.amount),
    frequency: row.frequency as Frequency,
    category: row.category ?? "other",
    nextDate: parseDateOnly(row.next_date) ?? row.next_date,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function recurringExpenseToRow(
  expense: RecurringExpense,
  userId: string
): Record<string, unknown> {
  return {
    id: ensureUuid(expense.id),
    user_id: userId,
    name: expense.name,
    amount: expense.amount,
    frequency: expense.frequency,
    category: expense.category,
    next_date: expense.nextDate.slice(0, 10),
    notes: expense.notes ?? null,
    updated_at: new Date().toISOString(),
  };
}

function recurringExpenseRowToDomain(row: RecurringExpenseRow): RecurringExpense {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    frequency: row.frequency as Frequency,
    category: row.category as ExpenseCategory,
    nextDate: parseDateOnly(row.next_date) ?? row.next_date,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function parseFinancialProfileSnapshot(raw: unknown): Partial<FinancialProfile> {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  return {
    availableFunds:
      typeof p.availableFunds === "number" ? p.availableFunds : undefined,
    monthlyIncome:
      typeof p.monthlyIncome === "number" ? p.monthlyIncome : undefined,
    monthlyExpenses:
      typeof p.monthlyExpenses === "number" ? p.monthlyExpenses : undefined,
    incomeStability:
      p.incomeStability === "stable" ||
      p.incomeStability === "variable" ||
      p.incomeStability === "uncertain"
        ? p.incomeStability
        : undefined,
  };
}

async function syncCatalogDebts(
  supabase: SupabaseClient,
  userId: string,
  rows: Record<string, unknown>[]
): Promise<ProResult<null>> {
  const keepIds = rows.map((r) => r.id as string);

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("debts")
      .upsert(rows, { onConflict: "id" });
    if (upsertError) return fromSupabaseError(upsertError, "Failed to save debts");
  }

  const { data: existing, error: listError } = await supabase
    .from("debts")
    .select("id")
    .eq("user_id", userId)
    .is("session_id", null);

  if (listError) return fromSupabaseError(listError, "Failed to list debts");

  const orphanIds = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepIds.includes(id));

  if (orphanIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("debts")
      .delete()
      .in("id", orphanIds);
    if (deleteError) return fromSupabaseError(deleteError, "Failed to prune debts");
  }

  return success(null);
}

const DEBT_SELECT =
  "id, user_id, session_id, creditor_name, amount, due_date, critical_date, critical_note, category, priority_level, notes, minimum_payment, interest_rate, is_recurring, frequency, created_at, updated_at";

const INCOME_SELECT =
  "id, user_id, source, amount, frequency, next_date, notes, created_at, updated_at";

const EXPENSE_SELECT =
  "id, user_id, name, amount, frequency, category, next_date, notes, created_at, updated_at";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Load full Pro profile: settings + catalog + latest session snapshot. */
export async function getUserFinancialProfile(
  userId: string
): Promise<ProResult<UserFinancialProfile>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  const supabase = getClient();

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select(
      "currency, subscription_tier, subscription_expires_at, financial_last_updated"
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) return fromSupabaseError(profileError, "Failed to load profile");
  if (!profileRow) {
    return success(createEmptyUserFinancialProfile(userId));
  }

  const profile = profileRow as ProfileRow;

  const { data: latestSession } = await supabase
    .from("financial_sessions")
    .select("profile_data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshot = parseFinancialProfileSnapshot(latestSession?.profile_data);

  const [debtsResult, incomesResult, expensesResult] = await Promise.all([
    getDebts(userId),
    getRecurringIncomes(userId),
    getRecurringExpenses(userId),
  ]);

  if (!debtsResult.ok) return debtsResult;
  if (!incomesResult.ok) return incomesResult;
  if (!expensesResult.ok) return expensesResult;

  const lastUpdated =
    profile.financial_last_updated ??
    latestSession?.created_at ??
    new Date().toISOString();

  return success({
    userId,
    availableFunds: snapshot.availableFunds ?? 0,
    currency: profile.currency ?? DEFAULT_APP_CURRENCY,
    debts: debtsResult.data,
    recurringIncomes: incomesResult.data,
    recurringExpenses: expensesResult.data,
    monthlyIncome: snapshot.monthlyIncome,
    monthlyExpenses: snapshot.monthlyExpenses,
    incomeStability: snapshot.incomeStability,
    lastUpdated,
    subscriptionTier: profile.subscription_tier ?? "free",
    subscriptionExpiresAt: profile.subscription_expires_at ?? null,
  });
}

/** Save user debt catalog (session_id IS NULL). Replaces full catalog set. */
export async function saveDebts(
  userId: string,
  debts: Debt[]
): Promise<ProResult<Debt[]>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  const supabase = getClient();
  const rows = debts.map((d) => debtToRow(d, userId, null));

  const synced = await syncCatalogDebts(supabase, userId, rows);
  if (!synced.ok) return synced;

  return getDebts(userId);
}

/** Remove one debt from catalog or session scope. */
export async function deleteDebt(
  userId: string,
  debtId: string,
  sessionId?: string
): Promise<ProResult<Debt[]>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  if (!sessionId) {
    const current = await getDebts(userId);
    if (!current.ok) return current;
    return saveDebts(
      userId,
      current.data.filter((d) => d.id !== debtId)
    );
  }

  const supabase = getClient();
  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", debtId)
    .eq("user_id", userId);

  if (error) return fromSupabaseError(error, "Failed to delete debt");
  return getDebts(userId, sessionId);
}

/** Load debts — catalog (no sessionId) or session-scoped. */
export async function getDebts(
  userId: string,
  sessionId?: string
): Promise<ProResult<Debt[]>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  const supabase = getClient();

  let query = supabase
    .from("debts")
    .select(DEBT_SELECT)
    .eq("user_id", userId)
    .order("priority_level", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  query = sessionId
    ? query.eq("session_id", sessionId)
    : query.is("session_id", null);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error, "Failed to load debts");

  return success(((data ?? []) as DebtRow[]).map(debtRowToDomain));
}

/** Replace full recurring income catalog for the user. */
export async function saveRecurringIncomes(
  userId: string,
  incomes: RecurringIncome[]
): Promise<ProResult<RecurringIncome[]>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  const supabase = getClient();
  const rows = incomes.map((i) => recurringIncomeToRow(i, userId));

  const { error: upsertError } = await supabase
    .from("recurring_incomes")
    .upsert(rows, { onConflict: "id" });
  if (upsertError) {
    return fromSupabaseError(upsertError, "Failed to save recurring incomes");
  }

  const keepIds = rows.map((r) => r.id as string);
  const { data: existing, error: listError } = await supabase
    .from("recurring_incomes")
    .select("id")
    .eq("user_id", userId);

  if (listError) return fromSupabaseError(listError, "Failed to list recurring incomes");

  const orphanIds = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepIds.includes(id));

  if (orphanIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("recurring_incomes")
      .delete()
      .in("id", orphanIds);
    if (deleteError) {
      return fromSupabaseError(deleteError, "Failed to prune recurring incomes");
    }
  }

  return getRecurringIncomes(userId);
}

/** Remove one recurring income entry. */
export async function deleteRecurringIncome(
  userId: string,
  incomeId: string
): Promise<ProResult<RecurringIncome[]>> {
  const current = await getRecurringIncomes(userId);
  if (!current.ok) return current;
  return saveRecurringIncomes(
    userId,
    current.data.filter((i) => i.id !== incomeId)
  );
}

export async function getRecurringIncomes(
  userId: string
): Promise<ProResult<RecurringIncome[]>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  const supabase = getClient();

  const { data, error } = await supabase
    .from("recurring_incomes")
    .select(INCOME_SELECT)
    .eq("user_id", userId)
    .order("next_date", { ascending: true });

  if (error) return fromSupabaseError(error, "Failed to load recurring incomes");

  return success((data as RecurringIncomeRow[]).map(recurringIncomeRowToDomain));
}

/** Replace full recurring expense catalog for the user. */
export async function saveRecurringExpenses(
  userId: string,
  expenses: RecurringExpense[]
): Promise<ProResult<RecurringExpense[]>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  const supabase = getClient();
  const rows = expenses.map((e) => recurringExpenseToRow(e, userId));

  const { error: upsertError } = await supabase
    .from("recurring_expenses")
    .upsert(rows, { onConflict: "id" });
  if (upsertError) {
    return fromSupabaseError(upsertError, "Failed to save recurring expenses");
  }

  const keepIds = rows.map((r) => r.id as string);
  const { data: existing, error: listError } = await supabase
    .from("recurring_expenses")
    .select("id")
    .eq("user_id", userId);

  if (listError) return fromSupabaseError(listError, "Failed to list recurring expenses");

  const orphanIds = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepIds.includes(id));

  if (orphanIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("recurring_expenses")
      .delete()
      .in("id", orphanIds);
    if (deleteError) {
      return fromSupabaseError(deleteError, "Failed to prune recurring expenses");
    }
  }

  return getRecurringExpenses(userId);
}

/** Remove one recurring expense entry. */
export async function deleteRecurringExpense(
  userId: string,
  expenseId: string
): Promise<ProResult<RecurringExpense[]>> {
  const current = await getRecurringExpenses(userId);
  if (!current.ok) return current;
  return saveRecurringExpenses(
    userId,
    current.data.filter((e) => e.id !== expenseId)
  );
}

export async function getRecurringExpenses(
  userId: string
): Promise<ProResult<RecurringExpense[]>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  const supabase = getClient();

  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(EXPENSE_SELECT)
    .eq("user_id", userId)
    .order("next_date", { ascending: true });

  if (error) return fromSupabaseError(error, "Failed to load recurring expenses");

  return success((data as RecurringExpenseRow[]).map(recurringExpenseRowToDomain));
}

export interface CreateFinancialSessionOptions {
  currency?: AppCurrency;
  title?: string;
  source?: "chat" | "manual" | "api" | "import";
  locale?: string;
}

export interface FinancialSessionRecord {
  sessionId: string;
  profile: FinancialProfile;
  recommendation: PrioritizationResult | null;
}

/** Persist a prioritization run (snapshot + optional session debts). */
export async function createFinancialSession(
  userId: string,
  profileData: FinancialProfile,
  recommendation: PrioritizationResult | null,
  options: CreateFinancialSessionOptions = {}
): Promise<ProResult<FinancialSessionRecord>> {
  const blocked = guardProAccess(await ensureProAccess(userId));
  if (blocked) return blocked;

  const supabase = getClient();
  const sessionId = crypto.randomUUID();
  const currency = options.currency ?? DEFAULT_APP_CURRENCY;

  const profilePayload = {
    ...(options.locale ? { locale: options.locale } : {}),
    availableFunds: profileData.availableFunds,
    monthlyIncome: profileData.monthlyIncome,
    monthlyExpenses: profileData.monthlyExpenses,
    incomeStability: profileData.incomeStability,
  };

  const { error: sessionError } = await supabase.from("financial_sessions").insert({
    id: sessionId,
    user_id: userId,
    currency,
    title: options.title ?? null,
    source: options.source ?? "manual",
    profile_data: profilePayload,
    recommendation,
    available_funds: profileData.availableFunds,
    monthly_income: profileData.monthlyIncome ?? null,
    monthly_expenses: profileData.monthlyExpenses ?? null,
    income_stability: profileData.incomeStability ?? null,
  });

  if (sessionError) {
    return fromSupabaseError(sessionError, "Failed to create financial session");
  }

  if (profileData.debts.length > 0) {
    const debtRows = profileData.debts.map((d) => debtToRow(d, userId, sessionId));
    const { error: debtsError } = await supabase
      .from("debts")
      .upsert(debtRows, { onConflict: "id" });
    if (debtsError) {
      return fromSupabaseError(debtsError, "Failed to save session debts");
    }
  }

  return success({
    sessionId,
    profile: profileData,
    recommendation,
  });
}

/*
 * Usage examples (React client components):
 *
 * import { useAuth } from "@/components/providers/auth-provider";
 * import {
 *   getUserFinancialProfile,
 *   saveDebts,
 *   createFinancialSession,
 * } from "@/lib/supabase/pro-financial";
 *
 * const { user } = useAuth();
 * if (!user) return;
 *
 * const profileResult = await getUserFinancialProfile(user.id);
 * if (!profileResult.ok) {
 *   console.error(profileResult.error.message);
 *   return;
 * }
 * setProfile(profileResult.data);
 *
 * const saved = await saveDebts(user.id, updatedDebts);
 * if (saved.ok) setDebts(saved.data);
 *
 * const session = await createFinancialSession(
 *   user.id,
 *   { availableFunds: 12000, debts: engineDebts, incomeStability: "stable" },
 *   recommendation,
 *   { currency: "CZK", source: "manual", title: "June plan" }
 * );
 * if (session.ok) router.push(`/consultations/${session.data.sessionId}`);
 */
