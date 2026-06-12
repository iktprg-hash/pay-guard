import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { syncActiveSubscriptionByEmail } from "@/lib/billing/sync-checkout";
import {
  rateLimitError,
  serviceUnavailable,
} from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

/** Recover Pro from Stripe by account email (e.g. webhook missed). */
export async function POST(request: NextRequest) {
  if (!isStripeBillingConfigured()) {
    return serviceUnavailable("Billing is not configured");
  }

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  if (!auth.user.email) {
    return NextResponse.json(
      { error: "Account email required", code: "email_required" },
      { status: 422 }
    );
  }

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `billing-sync:${auth.user.id}:${ip}`,
    10,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const result = await syncActiveSubscriptionByEmail(
      auth.user.id,
      auth.user.email
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: "Could not sync subscription", code: result.code, detail: result.detail },
        { status: 422 }
      );
    }

    return NextResponse.json({ pro: true });
  } catch (error) {
    console.error("[api/billing/sync]", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
