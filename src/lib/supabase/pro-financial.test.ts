import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/supabase/ensure-pro-access", () => ({
  ensureProAccess: vi.fn(async () => ({ ok: true as const })),
}));

import {
  getDebts,
  getUserFinancialProfile,
} from "@/lib/supabase/pro-financial";

describe("pro-financial", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("getDebts returns mapped catalog debts", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "d1",
                    user_id: "u1",
                    session_id: null,
                    creditor_name: "Rent",
                    amount: 15000,
                    due_date: "2026-07-01",
                    critical_date: null,
                    critical_note: null,
                    category: "housing",
                    priority_level: 0,
                    notes: null,
                    minimum_payment: null,
                    interest_rate: null,
                    is_recurring: true,
                    frequency: "monthly",
                    created_at: "2026-06-01T00:00:00Z",
                    updated_at: null,
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    const result = await getDebts("u1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.creditor).toBe("Rent");
      expect(result.data[0]?.isRecurring).toBe(true);
    }
  });

  it("getUserFinancialProfile merges profile row and snapshot", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  currency: "CZK",
                  subscription_tier: "pro",
                  financial_last_updated: "2026-06-15T10:00:00Z",
                },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "financial_sessions") {
        const sessionRow = {
          data: {
            profile_data: {
              availableFunds: 8000,
              monthlyIncome: 35000,
            },
            created_at: "2026-06-14T12:00:00Z",
            updated_at: "2026-06-14T12:00:00Z",
          },
          error: null,
        };
        const chain = {
          maybeSingle: vi.fn().mockResolvedValue(sessionRow),
          limit: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
        chain.limit.mockReturnValue(chain);
        chain.order.mockReturnValue(chain);
        chain.neq.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        return {
          select: vi.fn(() => chain),
        };
      }
      if (table === "debts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => ({
                  is: vi.fn().mockResolvedValue({ data: [], error: null }),
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                })),
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      };
    });

    const result = await getUserFinancialProfile("u1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.currency).toBe("CZK");
      expect(result.data.subscriptionTier).toBe("pro");
      expect(result.data.availableFunds).toBe(8000);
      expect(result.data.monthlyIncome).toBe(35000);
    }
  });
});
