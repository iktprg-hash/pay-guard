import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeDebt } from "@/services/priorityEngine";
import type { Debt, DebtCategory } from "@/lib/types/financial";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DebtRow {
  id: string;
  user_id: string;
  session_id: string;
  creditor_name: string;
  amount: number;
  currency: string;
  due_date: string | null;
  critical_date: string | null;
  category: string;
  priority_level: number | null;
  notes: string | null;
  minimum_payment: number | null;
  critical_note: string | null;
  interest_rate: number | null;
  created_at: string;
  updated_at?: string;
}

function parseDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function toDebtId(clientId: string | undefined): string {
  if (clientId && UUID_RE.test(clientId)) return clientId;
  return crypto.randomUUID();
}

export function debtRowToDomain(row: DebtRow): Debt {
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
  };
}

export function domainToDebtRow(
  debt: Debt,
  sessionId: string,
  userId: string,
  currency = "CZK"
): Omit<DebtRow, "created_at" | "updated_at"> {
  const { level } = analyzeDebt(debt);
  return {
    id: toDebtId(debt.id),
    user_id: userId,
    session_id: sessionId,
    creditor_name: debt.creditor,
    amount: debt.amount,
    currency,
    due_date: debt.dueDate?.slice(0, 10) ?? null,
    critical_date: debt.criticalDate?.slice(0, 10) ?? null,
    category: debt.category,
    priority_level: level,
    notes: debt.notes ?? null,
    minimum_payment: debt.minimumPayment ?? null,
    critical_note: debt.criticalNote ?? null,
    interest_rate: debt.interestRate ?? null,
  };
}

/** Session-level fields stored in profile_data (debts live in debts table). */
export function sessionProfilePayload(
  profile: {
    availableFunds: number;
    monthlyIncome?: number;
    monthlyExpenses?: number;
    incomeStability?: string;
  },
  locale: string
): Record<string, unknown> {
  return {
    locale,
    availableFunds: profile.availableFunds,
    monthlyIncome: profile.monthlyIncome,
    monthlyExpenses: profile.monthlyExpenses,
    incomeStability: profile.incomeStability,
  };
}

export async function loadSessionDebts(
  supabase: SupabaseClient,
  sessionId: string
): Promise<Debt[]> {
  const { data, error } = await supabase
    .from("debts")
    .select(
      "id, user_id, session_id, creditor_name, amount, currency, due_date, critical_date, category, priority_level, notes, minimum_payment, critical_note, interest_rate, created_at, updated_at"
    )
    .eq("session_id", sessionId)
    .order("priority_level", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error || !data?.length) return [];
  return (data as DebtRow[]).map(debtRowToDomain);
}

export async function syncSessionDebts(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  debts: Debt[],
  currency = "CZK"
): Promise<boolean> {
  const rows = debts.map((d) => domainToDebtRow(d, sessionId, userId, currency));
  const keepIds = rows.map((r) => r.id);

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("debts")
      .upsert(
        rows.map((r) => ({
          ...r,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "id" }
      );
    if (upsertError) return false;
  }

  const { data: existing, error: listError } = await supabase
    .from("debts")
    .select("id")
    .eq("session_id", sessionId);

  if (listError) return false;

  const orphanIds = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepIds.includes(id));

  if (orphanIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("debts")
      .delete()
      .in("id", orphanIds);
    if (deleteError) return false;
  }

  return true;
}

export async function assignDebtsToUser(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<void> {
  await supabase
    .from("debts")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
}
