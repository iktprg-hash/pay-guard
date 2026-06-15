import { NextRequest, NextResponse } from "next/server";
import { getStripeWebhookSecret } from "@/lib/billing/config";
import { processStripeWebhookRequest } from "@/lib/billing/webhook-handler";

export const runtime = "nodejs";

/** Stripe webhook — canonical path for production (idempotent profile sync). */
export async function POST(request: NextRequest) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const result = await processStripeWebhookRequest(
    rawBody,
    signature,
    webhookSecret
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ received: true, skipped: result.skipped ?? false });
}
