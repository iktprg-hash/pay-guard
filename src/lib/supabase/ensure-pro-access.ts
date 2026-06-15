import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isProEnabledForProfile } from "@/lib/supabase/pro-access";
import type { SubscriptionTier } from "@/lib/types/financial";

export interface ProAccessResult {
  ok: boolean;
  error?: { message: string; code?: string };
}

/** Verify active Pro subscription before Pro catalog reads/writes. */
export async function ensureProAccess(userId: string): Promise<ProAccessResult> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      error: { message: "Supabase is not configured", code: "not_configured" },
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  const tier = (data?.subscription_tier as SubscriptionTier) ?? "free";
  const expiresAt = data?.subscription_expires_at ?? null;

  if (
    !isProEnabledForProfile({
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt,
    })
  ) {
    return {
      ok: false,
      error: { message: "Pro subscription required", code: "PRO_REQUIRED" },
    };
  }

  return { ok: true };
}
