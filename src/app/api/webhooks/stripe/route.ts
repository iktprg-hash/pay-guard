import { NextRequest } from "next/server";
import { respondToStripeWebhook } from "@/lib/billing/webhook-http";

export const runtime = "nodejs";

/** Stripe webhook — canonical path for production (idempotent profile sync). */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  return respondToStripeWebhook(rawBody, signature);
}
