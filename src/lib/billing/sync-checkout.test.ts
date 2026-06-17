import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { extractSupabaseUserId } from "@/lib/billing/subscription-sync";
import {
  describeBillingSyncClientError,
  syncCheckoutSessionForUser,
  syncActiveSubscriptionByEmail,
} from "@/lib/billing/sync-checkout";

vi.mock("@/lib/billing/stripe-client", () => ({
  getStripeClient: vi.fn(),
}));

vi.mock("@/lib/billing/profile-billing", () => ({
  applyStripeSubscriptionToUser: vi.fn(),
}));

describe("billing sync helpers", () => {
  it("maps sync error codes to user-safe messages without internal details", () => {
    const message = describeBillingSyncClientError("profile_update_failed");
    expect(message).not.toMatch(/SUPABASE|SERVICE_ROLE|KEY/i);
    expect(message.length).toBeGreaterThan(10);
  });
  it("extracts supabase user id from checkout metadata", () => {
    expect(
      extractSupabaseUserId({ supabase_user_id: "user-123" })
    ).toBe("user-123");
  });

  it("matches session ownership via client_reference_id", () => {
    const session = {
      client_reference_id: "user-abc",
      metadata: {},
    } as Stripe.Checkout.Session;

    const userId = "user-abc";
    const owns =
      session.client_reference_id === userId ||
      extractSupabaseUserId(session.metadata) === userId;

    expect(owns).toBe(true);
  });

  it("returns session_incomplete when Stripe cannot retrieve checkout session", async () => {
    const { getStripeClient } = await import("@/lib/billing/stripe-client");
    vi.mocked(getStripeClient).mockReturnValue({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockRejectedValue(new Error("No such checkout.session")),
        },
      },
    } as unknown as Stripe);

    const result = await syncCheckoutSessionForUser(
      "user-123",
      "cs_test_nonexistent"
    );

    expect(result).toEqual({ ok: false, code: "session_incomplete" });
  });

  it("rejects email sync when subscription metadata belongs to another user", async () => {
    const { getStripeClient } = await import("@/lib/billing/stripe-client");
    vi.mocked(getStripeClient).mockReturnValue({
      customers: {
        list: vi.fn().mockResolvedValue({
          data: [{ id: "cus_123" }],
        }),
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "sub_123",
              status: "active",
              metadata: { supabase_user_id: "other-user" },
            },
          ],
        }),
      },
    } as unknown as Stripe);

    const result = await syncActiveSubscriptionByEmail(
      "user-123",
      "victim@example.com"
    );

    expect(result).toEqual({ ok: false, code: "session_mismatch" });
  });
});
