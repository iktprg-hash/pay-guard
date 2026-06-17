import { NextResponse } from "next/server";
import { runPriorityEngine } from "@/services/priorityEngine";
import { withAuth } from "@/lib/api/protected";
import {
  createAppError,
  respondWithError,
  respondWithValidationError,
  toApiResponse,
} from "@/lib/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { hasMinimumRecommendationData } from "@/lib/grok/recommendation-readiness";
import {
  normalizeProfile,
  prioritizeRequestSchema,
} from "@/lib/validation/schemas";

export const POST = withAuth(
  async (request) => {
    const parsed = await parseJsonBody(request, prioritizeRequestSchema);
    if (!parsed.ok) return respondWithValidationError(parsed.error);

    try {
      const { profile, locale } = parsed.data;
      const normalizedProfile = normalizeProfile(profile);

      if (!hasMinimumRecommendationData(normalizedProfile)) {
        return respondWithError("PRIORITIZATION_INSUFFICIENT_DATA");
      }

      const result = runPriorityEngine(normalizedProfile, locale);

      return NextResponse.json(result);
    } catch (error) {
      console.error("[api/prioritize]", error);
      return toApiResponse(
        createAppError("PRIORITIZATION_FAILED", { cause: error }),
        { locale: parsed.data.locale }
      );
    }
  },
  { rateLimit: "prioritize" }
);
