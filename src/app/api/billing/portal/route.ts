import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { getUserBillingRecord } from "@/lib/billing/profile-billing";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { resolveSiteOrigin } from "@/lib/site/url";
import {
  rateLimitError,
  serviceUnavailable,
  validationError,
} from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

const bodySchema = z.object({
  locale: z.enum(["cs", "ru", "en"]).default("cs"),
});

/** Stripe Customer Portal — manage / cancel subscription. */
export async function POST(request: NextRequest) {
  if (!isStripeBillingConfigured()) {
    return serviceUnavailable("Billing is not configured");
  }

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `billing-portal:${auth.user.id}:${ip}`,
    15,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationError(parsed.error);

    const billing = await getUserBillingRecord(auth.user.id);
    if (!billing?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found", code: "no_customer" },
        { status: 404 }
      );
    }

    const { locale } = parsed.data;
    const origin = resolveSiteOrigin(request);
    const stripe = getStripeClient();

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${origin}/${locale}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[api/billing/portal]", error);
    return NextResponse.json({ error: "Portal failed" }, { status: 500 });
  }
}
