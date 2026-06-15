import { createServiceClient } from "@/lib/supabase/service";

/**
 * Returns true if this event was already processed (skip handler).
 * Records the event id on first sight — safe for Stripe retries.
 */
export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    console.warn("[billing] webhook idempotency skipped — no service client");
    return false;
  }

  const { data: existing } = await supabase
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (existing?.id) return true;

  const { error } = await supabase.from("stripe_webhook_events").insert({
    id: eventId,
    event_type: "pending",
  });

  if (error) {
    if (error.code === "23505") return true;
    console.error("[billing] webhook idempotency insert failed:", error.message);
  }

  return false;
}

export async function markStripeEventType(
  eventId: string,
  eventType: string
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase
    .from("stripe_webhook_events")
    .update({ event_type: eventType })
    .eq("id", eventId);
}
