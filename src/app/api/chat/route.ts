import { NextResponse } from "next/server";
import { chatWithGrok, GrokUnavailableError, GrokRequestError } from "@/lib/grok/client";
import { mergeProfileUpdate } from "@/lib/grok/prompts";
import { assessRecommendationReadiness, hasMinimumRecommendationData } from "@/lib/grok/recommendation-readiness";
import { withAuth } from "@/lib/api/protected";
import { getUserGrokConsent } from "@/lib/auth/grok-consent";
import {
  createAppError,
  handleApiError,
  respondWithError,
  respondWithValidationError,
} from "@/lib/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import {
  chatRequestSchema,
  normalizeProfile,
} from "@/lib/validation/schemas";
import { enrichProfileFromMessage } from "@/lib/financial/currency-convert";
import { runPriorityEngine } from "@/services/priorityEngine";

export const POST = withAuth(
  async (request, { user }) => {
    try {
      const parsed = await parseJsonBody(request, chatRequestSchema);
      if (!parsed.ok) return respondWithValidationError(parsed.error);

      const { messages, profile, locale } = parsed.data;

      const hasConsent = await getUserGrokConsent(user.id);
      if (!hasConsent) {
        return respondWithError("UNAUTHORIZED");
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
        (postReadiness.shouldAutoDeliver ||
          hasMinimumRecommendationData(mergedProfile)) &&
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
        return respondWithError("INTERNAL_ERROR", { statusCode: 503 });
      }
      if (error instanceof GrokRequestError) {
        console.error("[api/chat] grok status:", error.status);
        return respondWithError("CHAT_PROCESSING_FAILED", {
          statusCode: 502,
          details: { upstreamStatus: error.status },
        });
      }
      console.error("[api/chat]", error);
      return handleApiError(
        createAppError("CHAT_PROCESSING_FAILED", { details: error }),
        { locale: "cs" }
      );
    }
  },
  { rateLimit: "chat" }
);
