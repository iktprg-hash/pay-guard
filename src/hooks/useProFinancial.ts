"use client";

/**
 * TanStack Query hooks for Pay Guard Pro financial data.
 *
 * Features:
 * - Stable query keys (`proFinancialKeys`) for cache control
 * - Optimistic updates on save/delete mutations
 * - Toast + console error reporting
 * - Dashboard summary via {@link useProFinancialSummary}
 *
 * @example
 * ```tsx
 * function ProDashboard() {
 *   const { summary, isLoading } = useProFinancialSummary();
 *   const { saveDebtsAsync } = useDebts();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <p>
 *       {summary.urgentDebts.length} urgent · {summary.netMonthlyCashFlow} CZK/mo
 *     </p>
 *   );
 * }
 * ```
 */

import { useCallback, useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/ui/toast-provider";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import {
  createFinancialSession,
  deleteDebt,
  deleteRecurringExpense,
  deleteRecurringIncome,
  getDebts,
  getRecurringExpenses,
  getRecurringIncomes,
  getUserFinancialProfile,
  saveDebts,
  saveRecurringExpenses,
  saveRecurringIncomes,
  type CreateFinancialSessionOptions,
  type FinancialSessionRecord,
  type ProResult,
} from "@/lib/supabase/pro-financial";
import type {
  AppCurrency,
  Debt,
  FinancialProfile,
  Frequency,
  PrioritizationResult,
  RecurringExpense,
  RecurringIncome,
  UserFinancialProfile,
} from "@/lib/types/financial";
import { DEFAULT_APP_CURRENCY } from "@/lib/types/financial";
import { analyzeDebt } from "@/services/priorityEngine";

// ---------------------------------------------------------------------------
// Query keys & defaults
// ---------------------------------------------------------------------------

/** Stable query keys for Pro financial cache invalidation. */
export const proFinancialKeys = {
  all: ["pro-financial"] as const,
  profile: (userId: string) =>
    [...proFinancialKeys.all, "profile", userId] as const,
  debts: (userId: string, sessionId?: string) =>
    [
      ...proFinancialKeys.all,
      "debts",
      userId,
      sessionId ?? "catalog",
    ] as const,
  incomes: (userId: string) =>
    [...proFinancialKeys.all, "incomes", userId] as const,
  expenses: (userId: string) =>
    [...proFinancialKeys.all, "expenses", userId] as const,
};

const PRO_STALE_MS = 60_000;
const PRO_GC_MS = 5 * 60_000;
const PRO_QUERY_RETRY = 2;

/** Shared TanStack Query options for all Pro financial reads. */
const proQueryDefaults = {
  staleTime: PRO_STALE_MS,
  gcTime: PRO_GC_MS,
  retry: PRO_QUERY_RETRY,
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function unwrapProResult<T>(
  result: ProResult<T> | Promise<ProResult<T>>
): Promise<T> {
  const resolved = await result;
  if (!resolved.ok) {
    const err = new Error(resolved.error.message) as Error & { code?: string };
    if (resolved.error.code) err.code = resolved.error.code;
    throw err;
  }
  return resolved.data;
}

function useProUserId(): string | undefined {
  const { user, loading } = useAuth();
  if (loading || !user?.id) return undefined;
  return user.id;
}

function useProQueriesEnabled(): boolean {
  const userId = useProUserId();
  const { isProEnabled, loading: tierLoading } = useSubscriptionTier();
  return Boolean(userId) && isProEnabled && !tierLoading;
}

export function isProRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return code === "PRO_REQUIRED" || code === "pro_required";
}

function useProMutationErrors() {
  const t = useTranslations("toast");
  const tPro = useTranslations("pro.upgrade");

  return useCallback(
    (
      error: unknown,
      fallbackKey:
        | "proSaveFailed"
        | "proDeleteFailed"
        | "proSessionFailed"
        | "proRequired"
    ) => {
      const message = isProRequiredError(error)
        ? tPro("mutationBlocked")
        : error instanceof Error && error.message.trim().length > 0
          ? error.message
          : fallbackKey === "proDeleteFailed"
            ? t("proDeleteFailed")
            : fallbackKey === "proSessionFailed"
              ? t("proSessionFailed")
              : t("proSaveFailed");

      console.error("[useProFinancial]", message, error);
      toast(message, "error");
    },
    [t, tPro]
  );
}

function invalidateProProfile(queryClient: QueryClient, userId: string) {
  void queryClient.invalidateQueries({
    queryKey: proFinancialKeys.profile(userId),
  });
}

function patchProfileDebts(
  queryClient: QueryClient,
  userId: string,
  debts: Debt[]
) {
  queryClient.setQueryData<UserFinancialProfile>(
    proFinancialKeys.profile(userId),
    (prev) => (prev ? { ...prev, debts } : prev)
  );
}

function patchProfileIncomes(
  queryClient: QueryClient,
  userId: string,
  recurringIncomes: RecurringIncome[]
) {
  queryClient.setQueryData<UserFinancialProfile>(
    proFinancialKeys.profile(userId),
    (prev) => (prev ? { ...prev, recurringIncomes } : prev)
  );
}

function patchProfileExpenses(
  queryClient: QueryClient,
  userId: string,
  recurringExpenses: RecurringExpense[]
) {
  queryClient.setQueryData<UserFinancialProfile>(
    proFinancialKeys.profile(userId),
    (prev) => (prev ? { ...prev, recurringExpenses } : prev)
  );
}

/** Convert recurring amount to an approximate monthly equivalent. */
export function amountToMonthlyEquivalent(
  amount: number,
  frequency: Frequency
): number {
  switch (frequency) {
    case "monthly":
      return amount;
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "one_time":
      return 0;
    default:
      return amount;
  }
}

function sumMonthlyRecurring<T extends { amount: number; frequency: Frequency }>(
  items: T[]
): number {
  return items.reduce(
    (sum, item) => sum + amountToMonthlyEquivalent(item.amount, item.frequency),
    0
  );
}

function createOptimisticListMutationHandlers<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  options: {
    userId: string | undefined;
    onProfilePatch?: (items: T[]) => void;
    onError: (error: unknown, fallbackKey: "proSaveFailed" | "proDeleteFailed" | "proRequired") => void;
  }
) {
  const snapshotProfile = () =>
    options.userId
      ? queryClient.getQueryData<UserFinancialProfile>(
          proFinancialKeys.profile(options.userId)
        )
      : undefined;

  const rollbackProfile = (previousProfile?: UserFinancialProfile) => {
    if (options.userId && previousProfile !== undefined) {
      queryClient.setQueryData(
        proFinancialKeys.profile(options.userId),
        previousProfile
      );
    }
  };

  return {
    onMutateSave: async (items: T[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<T[]>(queryKey);
      const previousProfile = snapshotProfile();
      queryClient.setQueryData(queryKey, items);
      options.onProfilePatch?.(items);
      return { previous, previousProfile };
    },
    onMutateDelete: async (itemId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<T[]>(queryKey);
      const previousProfile = snapshotProfile();
      const optimistic = (previous ?? []).filter((item) => item.id !== itemId);
      queryClient.setQueryData(queryKey, optimistic);
      options.onProfilePatch?.(optimistic);
      return { previous, previousProfile };
    },
    onError: (
      error: unknown,
      _variables: unknown,
      context:
        | { previous?: T[]; previousProfile?: UserFinancialProfile }
        | undefined,
      fallbackKey: "proSaveFailed" | "proDeleteFailed" | "proRequired"
    ) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
        options.onProfilePatch?.(context.previous);
      }
      rollbackProfile(context?.previousProfile);
      const key = isProRequiredError(error) ? "proRequired" : fallbackKey;
      options.onError(error, key);
    },
    onSuccess: (data: T[]) => {
      queryClient.setQueryData(queryKey, data);
      options.onProfilePatch?.(data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  };
}

/** Base shape shared by list hooks (debts, incomes, expenses). */
interface ProListHookBase<T> {
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: UseQueryResult<T[], Error>["refetch"];
  isSaving: boolean;
  isDeleting: boolean;
  isMutating: boolean;
  saveError: Error | null;
  deleteError: Error | null;
}

// ---------------------------------------------------------------------------
// Summary types
// ---------------------------------------------------------------------------

/** Aggregated metrics for Pro dashboard widgets. */
export interface ProFinancialSummary {
  profile: UserFinancialProfile | undefined;
  currency: AppCurrency;
  availableFunds: number;
  totalDebtAmount: number;
  minimumPaymentsDue: number;
  debtCount: number;
  /** Priority level 0 — critical / execution risk. */
  criticalDebts: Debt[];
  /** Priority levels 0–1 — due soon or critical. */
  urgentDebts: Debt[];
  monthlyRecurringIncome: number;
  monthlyRecurringExpense: number;
  /** Recurring income minus recurring expenses (monthly equivalent). */
  netMonthlyCashFlow: number;
  /** Snapshot from latest session, when available. */
  monthlyIncome?: number;
  monthlyExpenses?: number;
  incomeStability?: UserFinancialProfile["incomeStability"];
  subscriptionTier: UserFinancialProfile["subscriptionTier"];
  lastUpdated?: string;
}

export interface UseProFinancialSummaryResult {
  summary: ProFinancialSummary;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: UseQueryResult<UserFinancialProfile, Error>["refetch"];
}

function buildProFinancialSummary(
  profile: UserFinancialProfile | undefined
): ProFinancialSummary {
  const debts = profile?.debts ?? [];
  const recurringIncomes = profile?.recurringIncomes ?? [];
  const recurringExpenses = profile?.recurringExpenses ?? [];

  const analyzed = debts.map((debt) => analyzeDebt(debt));
  const criticalDebts = analyzed.filter((a) => a.level === 0).map((a) => a.debt);
  const urgentDebts = analyzed.filter((a) => a.level <= 1).map((a) => a.debt);

  const monthlyRecurringIncome = sumMonthlyRecurring(recurringIncomes);
  const monthlyRecurringExpense = sumMonthlyRecurring(recurringExpenses);

  return {
    profile,
    currency: profile?.currency ?? DEFAULT_APP_CURRENCY,
    availableFunds: profile?.availableFunds ?? 0,
    totalDebtAmount: debts.reduce((sum, d) => sum + d.amount, 0),
    minimumPaymentsDue: debts.reduce(
      (sum, d) => sum + (d.minimumPayment ?? d.amount),
      0
    ),
    debtCount: debts.length,
    criticalDebts,
    urgentDebts,
    monthlyRecurringIncome,
    monthlyRecurringExpense,
    netMonthlyCashFlow: monthlyRecurringIncome - monthlyRecurringExpense,
    monthlyIncome: profile?.monthlyIncome,
    monthlyExpenses: profile?.monthlyExpenses,
    incomeStability: profile?.incomeStability,
    subscriptionTier: profile?.subscriptionTier ?? "free",
    lastUpdated: profile?.lastUpdated,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Load the full Pro financial profile (settings + catalog + latest snapshot).
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useUserFinancialProfile();
 * if (data) console.log(data.currency, data.debts.length);
 * ```
 */
export function useUserFinancialProfile(): UseQueryResult<
  UserFinancialProfile,
  Error
> {
  const userId = useProUserId();
  const queriesEnabled = useProQueriesEnabled();

  return useQuery<UserFinancialProfile, Error>({
    queryKey: proFinancialKeys.profile(userId ?? ""),
    queryFn: () => unwrapProResult(getUserFinancialProfile(userId!)),
    enabled: queriesEnabled,
    ...proQueryDefaults,
  });
}

/**
 * Dashboard-ready summary derived from {@link useUserFinancialProfile}.
 *
 * @example
 * ```tsx
 * const { summary, isLoading } = useProFinancialSummary();
 *
 * return (
 *   <Card>
 *     <p>Available: {summary.availableFunds} {summary.currency}</p>
 *     <p>Urgent debts: {summary.urgentDebts.length}</p>
 *     <p>Net cash flow: {summary.netMonthlyCashFlow}/mo</p>
 *   </Card>
 * );
 * ```
 */
export function useProFinancialSummary(): UseProFinancialSummaryResult {
  const query = useUserFinancialProfile();

  const summary = useMemo(
    () => buildProFinancialSummary(query.data),
    [query.data]
  );

  return {
    summary,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export interface UseDebtsOptions {
  /** When set, loads session-scoped debts instead of the Pro catalog. */
  sessionId?: string;
  /** Show toast on mutation errors (default: true). */
  showErrorToast?: boolean;
}

export interface UseDebtsResult extends ProListHookBase<Debt> {
  debts: Debt[];
  /** Replace the full debt list (catalog or session). */
  saveDebts: (debts: Debt[]) => void;
  saveDebtsAsync: (debts: Debt[]) => Promise<Debt[]>;
  /** Remove a single debt by id. */
  deleteDebt: (debtId: string) => void;
  deleteDebtAsync: (debtId: string) => Promise<Debt[]>;
}

/**
 * Debt catalog (default) or session debts with optimistic save/delete.
 *
 * @example
 * ```tsx
 * const { debts, saveDebtsAsync, deleteDebtAsync, isSaving } = useDebts();
 *
 * await saveDebtsAsync([
 *   ...debts,
 *   { id: crypto.randomUUID(), creditor: "Rent", amount: 12000, category: "housing" },
 * ]);
 * await deleteDebtAsync(debts[0].id);
 * ```
 */
export function useDebts(options: UseDebtsOptions = {}): UseDebtsResult {
  const userId = useProUserId();
  const queriesEnabled = useProQueriesEnabled();
  const queryClient = useQueryClient();
  const reportError = useProMutationErrors();
  const { sessionId, showErrorToast = true } = options;

  const queryKey = proFinancialKeys.debts(userId ?? "", sessionId);
  const syncCatalogProfile = !sessionId;

  const query = useQuery({
    queryKey,
    queryFn: () => unwrapProResult(getDebts(userId!, sessionId)),
    enabled: queriesEnabled,
    ...proQueryDefaults,
  });

  const optimistic = createOptimisticListMutationHandlers<Debt>(
    queryClient,
    queryKey,
    {
      userId,
      onProfilePatch: syncCatalogProfile
        ? (debts) => userId && patchProfileDebts(queryClient, userId, debts)
        : undefined,
      onError: (error) => {
        if (showErrorToast) {
          reportError(
            error,
            isProRequiredError(error) ? "proRequired" : "proSaveFailed"
          );
        }
      },
    }
  );

  const saveMutation = useMutation({
    mutationFn: (debts: Debt[]) =>
      unwrapProResult(saveDebts(userId!, debts)),
    onMutate: optimistic.onMutateSave,
    onError: (error, variables, context) =>
      optimistic.onError(error, variables, context, "proSaveFailed"),
    onSuccess: (data) => {
      optimistic.onSuccess(data);
      if (syncCatalogProfile && userId) invalidateProProfile(queryClient, userId);
    },
    onSettled: optimistic.onSettled,
  });

  const deleteMutation = useMutation({
    mutationFn: (debtId: string) =>
      unwrapProResult(deleteDebt(userId!, debtId, sessionId)),
    onMutate: optimistic.onMutateDelete,
    onError: (error, variables, context) =>
      optimistic.onError(error, variables, context, "proDeleteFailed"),
    onSuccess: (data) => {
      optimistic.onSuccess(data);
      if (syncCatalogProfile && userId) invalidateProProfile(queryClient, userId);
    },
    onSettled: optimistic.onSettled,
  });

  return {
    debts: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    saveDebts: saveMutation.mutate,
    saveDebtsAsync: saveMutation.mutateAsync,
    deleteDebt: deleteMutation.mutate,
    deleteDebtAsync: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMutating: saveMutation.isPending || deleteMutation.isPending,
    saveError: saveMutation.error,
    deleteError: deleteMutation.error,
  };
}

// ---------------------------------------------------------------------------
// Recurring incomes
// ---------------------------------------------------------------------------

export interface UseRecurringIncomesOptions {
  showErrorToast?: boolean;
}

export interface UseRecurringIncomesResult extends ProListHookBase<RecurringIncome> {
  incomes: RecurringIncome[];
  saveIncomes: (incomes: RecurringIncome[]) => void;
  saveIncomesAsync: (incomes: RecurringIncome[]) => Promise<RecurringIncome[]>;
  deleteIncome: (incomeId: string) => void;
  deleteIncomeAsync: (incomeId: string) => Promise<RecurringIncome[]>;
}

/**
 * Recurring income catalog with optimistic save/delete.
 *
 * @example
 * ```tsx
 * const { incomes, saveIncomesAsync } = useRecurringIncomes();
 * await saveIncomesAsync([...incomes, newIncome]);
 * ```
 */
export function useRecurringIncomes(
  options: UseRecurringIncomesOptions = {}
): UseRecurringIncomesResult {
  const userId = useProUserId();
  const queriesEnabled = useProQueriesEnabled();
  const queryClient = useQueryClient();
  const reportError = useProMutationErrors();
  const { showErrorToast = true } = options;

  const queryKey = proFinancialKeys.incomes(userId ?? "");

  const query = useQuery({
    queryKey,
    queryFn: () => unwrapProResult(getRecurringIncomes(userId!)),
    enabled: queriesEnabled,
    ...proQueryDefaults,
  });

  const optimistic = createOptimisticListMutationHandlers<RecurringIncome>(
    queryClient,
    queryKey,
    {
      userId,
      onProfilePatch: (incomes) =>
        userId && patchProfileIncomes(queryClient, userId, incomes),
      onError: (error) => {
        if (showErrorToast) {
          reportError(
            error,
            isProRequiredError(error) ? "proRequired" : "proSaveFailed"
          );
        }
      },
    }
  );

  const saveMutation = useMutation({
    mutationFn: (incomes: RecurringIncome[]) =>
      unwrapProResult(saveRecurringIncomes(userId!, incomes)),
    onMutate: optimistic.onMutateSave,
    onError: (error, variables, context) =>
      optimistic.onError(error, variables, context, "proSaveFailed"),
    onSuccess: (data) => {
      optimistic.onSuccess(data);
      if (userId) invalidateProProfile(queryClient, userId);
    },
    onSettled: optimistic.onSettled,
  });

  const deleteMutation = useMutation({
    mutationFn: (incomeId: string) =>
      unwrapProResult(deleteRecurringIncome(userId!, incomeId)),
    onMutate: optimistic.onMutateDelete,
    onError: (error, variables, context) =>
      optimistic.onError(error, variables, context, "proDeleteFailed"),
    onSuccess: (data) => {
      optimistic.onSuccess(data);
      if (userId) invalidateProProfile(queryClient, userId);
    },
    onSettled: optimistic.onSettled,
  });

  return {
    incomes: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    saveIncomes: saveMutation.mutate,
    saveIncomesAsync: saveMutation.mutateAsync,
    deleteIncome: deleteMutation.mutate,
    deleteIncomeAsync: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMutating: saveMutation.isPending || deleteMutation.isPending,
    saveError: saveMutation.error,
    deleteError: deleteMutation.error,
  };
}

// ---------------------------------------------------------------------------
// Recurring expenses
// ---------------------------------------------------------------------------

export interface UseRecurringExpensesOptions {
  showErrorToast?: boolean;
}

export interface UseRecurringExpensesResult extends ProListHookBase<RecurringExpense> {
  expenses: RecurringExpense[];
  saveExpenses: (expenses: RecurringExpense[]) => void;
  saveExpensesAsync: (
    expenses: RecurringExpense[]
  ) => Promise<RecurringExpense[]>;
  deleteExpense: (expenseId: string) => void;
  deleteExpenseAsync: (expenseId: string) => Promise<RecurringExpense[]>;
}

/**
 * Recurring expense catalog with optimistic save/delete.
 *
 * @example
 * ```tsx
 * const { expenses, deleteExpenseAsync } = useRecurringExpenses();
 * await deleteExpenseAsync(expenses[0].id);
 * ```
 */
export function useRecurringExpenses(
  options: UseRecurringExpensesOptions = {}
): UseRecurringExpensesResult {
  const userId = useProUserId();
  const queriesEnabled = useProQueriesEnabled();
  const queryClient = useQueryClient();
  const reportError = useProMutationErrors();
  const { showErrorToast = true } = options;

  const queryKey = proFinancialKeys.expenses(userId ?? "");

  const query = useQuery({
    queryKey,
    queryFn: () => unwrapProResult(getRecurringExpenses(userId!)),
    enabled: queriesEnabled,
    ...proQueryDefaults,
  });

  const optimistic = createOptimisticListMutationHandlers<RecurringExpense>(
    queryClient,
    queryKey,
    {
      userId,
      onProfilePatch: (expenses) =>
        userId && patchProfileExpenses(queryClient, userId, expenses),
      onError: (error) => {
        if (showErrorToast) {
          reportError(
            error,
            isProRequiredError(error) ? "proRequired" : "proSaveFailed"
          );
        }
      },
    }
  );

  const saveMutation = useMutation({
    mutationFn: (expenses: RecurringExpense[]) =>
      unwrapProResult(saveRecurringExpenses(userId!, expenses)),
    onMutate: optimistic.onMutateSave,
    onError: (error, variables, context) =>
      optimistic.onError(error, variables, context, "proSaveFailed"),
    onSuccess: (data) => {
      optimistic.onSuccess(data);
      if (userId) invalidateProProfile(queryClient, userId);
    },
    onSettled: optimistic.onSettled,
  });

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) =>
      unwrapProResult(deleteRecurringExpense(userId!, expenseId)),
    onMutate: optimistic.onMutateDelete,
    onError: (error, variables, context) =>
      optimistic.onError(error, variables, context, "proDeleteFailed"),
    onSuccess: (data) => {
      optimistic.onSuccess(data);
      if (userId) invalidateProProfile(queryClient, userId);
    },
    onSettled: optimistic.onSettled,
  });

  return {
    expenses: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    saveExpenses: saveMutation.mutate,
    saveExpensesAsync: saveMutation.mutateAsync,
    deleteExpense: deleteMutation.mutate,
    deleteExpenseAsync: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMutating: saveMutation.isPending || deleteMutation.isPending,
    saveError: saveMutation.error,
    deleteError: deleteMutation.error,
  };
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

export interface CreateFinancialSessionInput {
  profile: FinancialProfile;
  recommendation: PrioritizationResult | null;
  options?: CreateFinancialSessionOptions;
}

type CreateFinancialSessionMutation = UseMutationResult<
  FinancialSessionRecord,
  Error,
  CreateFinancialSessionInput
>;

export type UseCreateFinancialSessionResult = CreateFinancialSessionMutation & {
  createSession: CreateFinancialSessionMutation["mutate"];
  createSessionAsync: CreateFinancialSessionMutation["mutateAsync"];
  isCreating: boolean;
};

/**
 * Mutation hook to persist a new prioritization session.
 * Invalidates profile cache and session-scoped debts on success.
 *
 * @example
 * ```tsx
 * const { createSessionAsync, isPending, error } = useCreateFinancialSession();
 *
 * const record = await createSessionAsync({
 *   profile: engineProfile,
 *   recommendation: engineResult,
 *   options: { source: "manual", title: "Plan A" },
 * });
 * router.push(`/consultations/${record.sessionId}`);
 * ```
 */
export function useCreateFinancialSession(options?: {
  showErrorToast?: boolean;
}): UseCreateFinancialSessionResult {
  const userId = useProUserId();
  const queryClient = useQueryClient();
  const reportError = useProMutationErrors();
  const showErrorToast = options?.showErrorToast ?? true;

  const mutation = useMutation({
    mutationFn: ({
      profile,
      recommendation,
      options: sessionOptions,
    }: CreateFinancialSessionInput) => {
      if (!userId) throw new Error("Sign in required");
      return unwrapProResult(
        createFinancialSession(userId, profile, recommendation, sessionOptions)
      );
    },
    onSuccess: (record) => {
      if (!userId) return;
      invalidateProProfile(queryClient, userId);
      void queryClient.invalidateQueries({
        queryKey: proFinancialKeys.debts(userId, record.sessionId),
      });
    },
    onError: (error) => {
      if (showErrorToast) {
        reportError(
          error,
          isProRequiredError(error) ? "proRequired" : "proSessionFailed"
        );
      }
    },
  });

  return {
    ...mutation,
    createSession: mutation.mutate,
    createSessionAsync: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidate all Pro financial queries for the signed-in user.
 *
 * @example
 * ```tsx
 * const invalidateAll = useInvalidateAllProData();
 * await signOut();
 * invalidateAll();
 * ```
 */
export function useInvalidateAllProData() {
  const userId = useProUserId();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (!userId) {
      await queryClient.invalidateQueries({ queryKey: proFinancialKeys.all });
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: proFinancialKeys.profile(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: proFinancialKeys.debts(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: proFinancialKeys.incomes(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: proFinancialKeys.expenses(userId),
      }),
    ]);
  }, [queryClient, userId]);
}

/**
 * @deprecated Use {@link useInvalidateAllProData} instead.
 */
export const useInvalidateProFinancial = useInvalidateAllProData;
