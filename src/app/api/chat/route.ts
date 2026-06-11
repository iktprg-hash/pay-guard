import { NextRequest, NextResponse } from "next/server";
import { chatWithGrok, GrokUnavailableError, GrokRequestError } from "@/lib/grok/client";
import { mergeProfileUpdate } from "@/lib/grok/prompts";
import { requireApiUser } from "@/lib/auth/session";
import {
  rateLimitError,
  serviceUnavailable,
  unauthorizedError,
  validationError,
} from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import {
  chatRequestSchema,
  normalizeProfile,
} from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(`chat:${auth.user.id}:${ip}`, 20, 60_000);
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { messages, profile, locale } = parsed.data;

    if (!parsed.data.grokConsent) {
      return unauthorizedError("Grok data processing consent required");
    }

    const normalizedProfile = normalizeProfile(profile);

    const result = await chatWithGrok(messages, normalizedProfile, locale);

    const mergedProfile = result.profileUpdate
      ? mergeProfileUpdate(normalizedProfile, result.profileUpdate)
      : normalizedProfile;

    return NextResponse.json({
      ...result,
      profile: mergedProfile,
    });
  } catch (error) {
    if (error instanceof GrokUnavailableError) {
      return serviceUnavailable("Chat service is not configured");
    }
    if (error instanceof GrokRequestError) {
      console.error("[api/chat] grok status:", error.status);
      return NextResponse.json({ error: "Chat request failed" }, { status: 502 });
    }
    console.error("[api/chat]", error);
    return NextResponse.json({ error: "Chat request failed" }, { status: 500 });
  }
}
