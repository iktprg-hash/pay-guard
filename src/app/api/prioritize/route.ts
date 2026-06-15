import { NextRequest, NextResponse } from "next/server";
import { runPriorityEngine } from "@/services/priorityEngine";
import { requireApiUser } from "@/lib/auth/session";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-request";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { hasMinimumRecommendationData } from "@/lib/grok/recommendation-readiness";
import {
  normalizeProfile,
  prioritizeRequestSchema,
} from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit(`prioritize:${auth.user.id}:${ip}`, 60, 60_000);
  if (!limit.allowed) return rateLimitError(limit.resetAt);

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
}
