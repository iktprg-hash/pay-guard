import { NextRequest } from "next/server";
import { respondToStripeWebhook } from "@/lib/billing/webhook-http";

export const runtime = "nodejs";

/** @deprecated Prefer POST /api/webhooks/stripe — kept for existing Stripe Dashboard URLs. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  return respondToStripeWebhook(rawBody, signature);
}
