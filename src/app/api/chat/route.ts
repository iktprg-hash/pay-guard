import { NextRequest, NextResponse } from "next/server";
import { chatWithGrok, GrokUnavailableError, GrokRequestError } from "@/lib/grok/client";
import { mergeProfileUpdate } from "@/lib/grok/prompts";
import { assessRecommendationReadiness, hasMinimumRecommendationData } from "@/lib/grok/recommendation-readiness";
import { requireApiUser } from "@/lib/auth/session";
import { getUserGrokConsent } from "@/lib/auth/grok-consent";
import {
  rateLimitError,
  serviceUnavailable,
  unauthorizedError,
  validationError,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import {
  chatRequestSchema,
  normalizeProfile,
} from "@/lib/validation/schemas";
import { enrichProfileFromMessage } from "@/lib/financial/currency-convert";
import { runPriorityEngine } from "@/services/priorityEngine";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(`chat:${auth.user.id}:${ip}`, 20, 60_000);
  if (!limit.allowed) return rateLimitError(limit.resetAt);

  try {
    const parsed = await parseJsonBody(request, chatRequestSchema);
    if (!parsed.ok) return validationError(parsed.error);

    const { messages, profile, locale } = parsed.data;

    const hasConsent = await getUserGrokConsent(auth.user.id);
    if (!hasConsent) {
      return unauthorizedError("Grok data processing consent required");
    }

    const normalizedProfile = normalizeProfile(profile);
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const preReadiness = assessRecommendationReadiness(normalizedProfile, {
      lastUserMessage,
    });

    const engineResult = hasMinimumRecommendationData(normalizedProfile)
      ? runPriorityEngine(normalizedProfile, locale)
      : null;

    const result = await chatWithGrok(messages, normalizedProfile, locale, {
      lastUserMessage,
      engineResult,
    });

    const mergedProfile = enrichProfileFromMessage(
      result.profileUpdate
        ? mergeProfileUpdate(normalizedProfile, result.profileUpdate)
        : normalizedProfile,
      lastUserMessage
    );

    const postReadiness = assessRecommendationReadiness(mergedProfile, {
      lastUserMessage,
    });

    let recommendation = result.recommendation ?? engineResult;
    if (!recommendation && hasMinimumRecommendationData(mergedProfile)) {
      recommendation = runPriorityEngine(mergedProfile, locale);
    }

    const readyForRecommendation =
      postReadiness.canRecommend || hasMinimumRecommendationData(mergedProfile);
    const shouldAttachRecommendation =
      (postReadiness.shouldAutoDeliver || hasMinimumRecommendationData(mergedProfile)) &&
      recommendation !== null;

    return NextResponse.json({
      message: result.message,
      profileUpdate: result.profileUpdate
        ? { ...result.profileUpdate, readyForRecommendation }
        : readyForRecommendation
          ? { readyForRecommendation: true, analysisMode: postReadiness.mode }
          : null,
      stage: result.stage,
      profile: mergedProfile,
      readyForRecommendation,
      analysisMode: postReadiness.mode,
      recommendation: shouldAttachRecommendation ? recommendation : null,
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
