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
          data: [{ id: "cus_123", metadata: {} }],
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

  it("rejects email sync when subscription and customer metadata are missing", async () => {
    const { getStripeClient } = await import("@/lib/billing/stripe-client");
    vi.mocked(getStripeClient).mockReturnValue({
      customers: {
        list: vi.fn().mockResolvedValue({
          data: [{ id: "cus_123", metadata: {} }],
        }),
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "sub_123",
              status: "active",
              metadata: {},
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

  it("allows email sync when customer metadata matches the authenticated user", async () => {
    const { getStripeClient } = await import("@/lib/billing/stripe-client");
    const { applyStripeSubscriptionToUser } = await import(
      "@/lib/billing/profile-billing"
    );

    const activeSub = {
      id: "sub_123",
      status: "active",
      metadata: {},
    };

    vi.mocked(getStripeClient).mockReturnValue({
      customers: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "cus_123",
              metadata: { supabase_user_id: "user-123" },
            },
          ],
        }),
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [activeSub],
        }),
      },
    } as unknown as Stripe);

    vi.mocked(applyStripeSubscriptionToUser).mockResolvedValue(true);

    const result = await syncActiveSubscriptionByEmail(
      "user-123",
      "owner@example.com"
    );

    expect(result).toEqual({ ok: true });
    expect(applyStripeSubscriptionToUser).toHaveBeenCalledWith(
      "user-123",
      activeSub
    );
  });

  it("rejects checkout confirm when retrieved subscription lacks ownership metadata", async () => {
    const { getStripeClient } = await import("@/lib/billing/stripe-client");

    vi.mocked(getStripeClient).mockReturnValue({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
            client_reference_id: "user-123",
            metadata: {},
            status: "complete",
            subscription: "sub_123",
          }),
        },
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_123",
          status: "active",
          metadata: {},
          customer: "cus_123",
        }),
      },
      customers: {
        retrieve: vi.fn().mockResolvedValue({
          id: "cus_123",
          metadata: {},
        }),
      },
    } as unknown as Stripe);

    const result = await syncCheckoutSessionForUser("user-123", "cs_test_ok");

    expect(result).toEqual({ ok: false, code: "session_mismatch" });
  });
});
