import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { extractSupabaseUserId } from "@/lib/billing/subscription-sync";
import { describeBillingSyncClientError } from "@/lib/billing/sync-checkout";

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
});
