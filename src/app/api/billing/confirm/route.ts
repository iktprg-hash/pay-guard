import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { isStripeBillingConfigured } from "@/lib/billing/config";
import { syncCheckoutSessionForUser } from "@/lib/billing/sync-checkout";
import {
  rateLimitError,
  serviceUnavailable,
  validationError,
} from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";

const bodySchema = z.object({
  sessionId: z.string().min(1),
});

/** Activate Pro from a completed Checkout session (fallback when webhook is delayed). */
export async function POST(request: NextRequest) {
  if (!isStripeBillingConfigured()) {
    return serviceUnavailable("Billing is not configured");
  }

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(
    `billing-confirm:${auth.user.id}:${ip}`,
    20,
    60_000
  );
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return validationError(parsed.error);

    const result = await syncCheckoutSessionForUser(
      auth.user.id,
      parsed.data.sessionId
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: "Could not confirm checkout", code: result.code, detail: result.detail },
        { status: 422 }
      );
    }

    return NextResponse.json({ pro: true });
  } catch (error) {
    console.error("[api/billing/confirm]", error);
    return NextResponse.json({ error: "Confirm failed" }, { status: 500 });
  }
}
