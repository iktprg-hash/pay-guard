import { NextResponse } from "next/server";
import { createAppError, respondWithError, toApiResponse } from "@/lib/errors";
import { getStripeWebhookSecret } from "@/lib/billing/config";
import {
  processStripeWebhookRequest,
  STRIPE_WEBHOOK_MAX_BODY_BYTES,
} from "@/lib/billing/webhook-handler";

/** Shared Stripe webhook HTTP handler (raw body + signature verification). */
export async function respondToStripeWebhook(
  rawBody: string,
  signature: string | null
): Promise<NextResponse> {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    console.error("[stripe/webhook] missing webhook secret for current Stripe mode");
    return respondWithError("SERVICE_UNAVAILABLE", {
      message: "Webhook not configured",
    });
  }

  if (rawBody.length > STRIPE_WEBHOOK_MAX_BODY_BYTES) {
    console.warn("[stripe/webhook] body too large", { bytes: rawBody.length });
    return respondWithError("BAD_REQUEST", {
      message: "Request body too large",
    });
  }

  const result = await processStripeWebhookRequest(
    rawBody,
    signature,
    webhookSecret
  );

  if (!result.ok) {
    console.warn("[stripe/webhook] rejected", {
      status: result.status,
      error: result.error,
    });
    return toApiResponse(
      createAppError(
        result.status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR",
        { message: result.error }
      )
    );
  }

  if (result.skipped) {
    console.info("[stripe/webhook] duplicate skipped", {
      eventId: result.eventId,
      eventType: result.eventType,
    });
  } else if (result.warning) {
    console.error("[stripe/webhook] handled with warning", {
      eventId: result.eventId,
      eventType: result.eventType,
      userId: result.userId,
      warning: result.warning,
    });
  } else {
    console.info("[stripe/webhook] success", {
      eventId: result.eventId,
      eventType: result.eventType,
      userId: result.userId,
      profileUpdated: result.profileUpdated ?? false,
    });
  }

  return NextResponse.json({
    received: true,
    skipped: result.skipped ?? false,
    ...(result.warning ? { warning: result.warning } : {}),
  });
}
