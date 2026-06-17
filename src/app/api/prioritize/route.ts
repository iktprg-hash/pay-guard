import { NextResponse } from "next/server";
import { runPriorityEngine } from "@/services/priorityEngine";
import { withAuth } from "@/lib/api/protected";
import { validationError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { hasMinimumRecommendationData } from "@/lib/grok/recommendation-readiness";
import {
  normalizeProfile,
  prioritizeRequestSchema,
} from "@/lib/validation/schemas";

export const POST = withAuth(
  async (request) => {
    const parsed = await parseJsonBody(request, prioritizeRequestSchema);
    if (!parsed.ok) return validationError(parsed.error);

    try {
      const { profile, locale } = parsed.data;
      const normalizedProfile = normalizeProfile(profile);

      if (!hasMinimumRecommendationData(normalizedProfile)) {
        return NextResponse.json(
          {
            error:
              "Insufficient data for prioritization — need availableFunds > 0 and at least one debt with creditor and amount.",
          },
          { status: 422 }
        );
      }

      const result = runPriorityEngine(normalizedProfile, locale);

      return NextResponse.json(result);
    } catch (error) {
      console.error("[api/prioritize]", error);
      return NextResponse.json(
        { error: "Prioritization failed" },
        { status: 500 }
      );
    }
  },
  { rateLimit: "prioritize" }
);
