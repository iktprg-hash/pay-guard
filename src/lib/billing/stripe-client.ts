import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/billing/config";

let stripeSingleton: Stripe | null = null;

export function getStripeClient(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }

  return stripeSingleton;
}
