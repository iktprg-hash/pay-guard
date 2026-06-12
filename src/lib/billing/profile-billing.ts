import { createServiceClient } from "@/lib/supabase/service";
import {
  mapStripeSubscriptionToProfile,
  profilePatchToRow,
  type ProfileSubscriptionPatch,
} from "@/lib/billing/subscription-sync";
import type Stripe from "stripe";

export interface UserBillingRecord {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export async function getUserBillingRecord(
  userId: string
): Promise<UserBillingRecord | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    stripeCustomerId: data.stripe_customer_id ?? null,
    stripeSubscriptionId: data.stripe_subscription_id ?? null,
  };
}

export async function applyProfileSubscriptionPatch(
  userId: string,
  patch: ProfileSubscriptionPatch
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("profiles")
    .update(profilePatchToRow(patch))
    .eq("id", userId);

  return !error;
}

export async function applyStripeSubscriptionToUser(
  userId: string,
  subscription: Stripe.Subscription
): Promise<boolean> {
  return applyProfileSubscriptionPatch(
    userId,
    mapStripeSubscriptionToProfile(subscription)
  );
}

export async function findUserIdByStripeCustomer(
  customerId: string
): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.id ?? null;
}
