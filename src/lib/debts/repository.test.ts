import { describe, expect, it, vi } from "vitest";
import { analyzeDebt } from "@/services/priorityEngine";
import type { Debt } from "@/lib/types/financial";
import {
  debtRowToDomain,
  domainToDebtRow,
  sessionProfilePayload,
  syncSessionDebts,
} from "@/lib/debts/repository";

describe("debts repository", () => {
  const sampleDebt: Debt = {
    id: "debt-local-1",
    creditor: "Landlord",
    amount: 15000,
    category: "housing",
    dueDate: "2026-06-15",
    criticalDate: "2026-06-20",
    criticalNote: "Eviction risk",
    minimumPayment: 5000,
    interestRate: 0,
    notes: "Rent arrears",
  };

  it("maps domain debt to row with priority_level from engine", () => {
    const row = domainToDebtRow(sampleDebt, "session-uuid", "user-uuid", "CZK");
    expect(row.creditor_name).toBe("Landlord");
    expect(row.priority_level).toBe(analyzeDebt(sampleDebt).level);
    expect(row.currency).toBe("CZK");
    expect(row.user_id).toBe("user-uuid");
    expect(row.session_id).toBe("session-uuid");
    expect(row.minimum_payment).toBe(5000);
    expect(row.critical_note).toBe("Eviction risk");
  });

  it("round-trips row to domain", () => {
    const row = domainToDebtRow(sampleDebt, "s1", "u1");
    const back = debtRowToDomain({
      ...row,
      created_at: new Date().toISOString(),
    });
    expect(back.creditor).toBe(sampleDebt.creditor);
    expect(back.amount).toBe(sampleDebt.amount);
    expect(back.dueDate).toBe("2026-06-15");
    expect(back.criticalNote).toBe("Eviction risk");
  });

  it("sessionProfilePayload excludes debts array", () => {
    const payload = sessionProfilePayload(
      { availableFunds: 1000, monthlyIncome: 30000 },
      "cs"
    );
    expect(payload).toEqual({
      locale: "cs",
      availableFunds: 1000,
      monthlyIncome: 30000,
      monthlyExpenses: undefined,
      incomeStability: undefined,
    });
    expect(payload).not.toHaveProperty("debts");
  });

  it("syncSessionDebts upserts and deletes orphans", async () => {
    const debtWithUuid: Debt = {
      ...sampleDebt,
      id: "550e8400-e29b-41d4-a716-446655440000",
    };
    const keepId = debtWithUuid.id;

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const selectEq = vi.fn().mockReturnValue({
      data: [{ id: "old-debt-id" }, { id: keepId }],
      error: null,
    });
    const deleteIn = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== "debts") throw new Error("unexpected table");
        return {
          upsert,
          select: vi.fn(() => ({ eq: selectEq })),
          delete: vi.fn(() => ({ in: deleteIn })),
        };
      }),
    };

    const ok = await syncSessionDebts(
      supabase as never,
      "session-1",
      "user-1",
      [debtWithUuid],
      "CZK"
    );

    expect(ok).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
    const upsertArg = upsert.mock.calls[0]?.[0] as Array<{ currency: string }>;
    expect(upsertArg[0]?.currency).toBe("CZK");
    expect(deleteIn).toHaveBeenCalledWith("id", ["old-debt-id"]);
  });
});
