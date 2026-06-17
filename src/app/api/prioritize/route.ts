import { NextResponse } from "next/server";
import { runPriorityEngine } from "@/services/priorityEngine";
import { withAuth } from "@/lib/api/protected";
import { createAppError, respondWithValidationError, toApiResponse } from "@/lib/errors";
import type { FinancialProfile } from "@/lib/types/financial";
import { FinancialProfileSchema } from "@/lib/validation/financial";

export const POST = withAuth(
  async (request) => {
    const body = (await request.json()) as {
      profile?: unknown;
      locale?: "cs" | "ru" | "en";
    };

    const parsed = FinancialProfileSchema.safeParse(body.profile);

    if (!parsed.success) {
      return respondWithValidationError(parsed.error);
    }

    const profile = parsed.data;
    const locale = body.locale ?? "cs";

    try {
      const result = runPriorityEngine(profile as FinancialProfile, locale);
      return NextResponse.json(result);
    } catch (error) {
      console.error("[api/prioritize]", error);
      return toApiResponse(
        createAppError("PRIORITIZATION_FAILED", { details: error }),
        { locale }
      );
    }
  },
  { rateLimit: "prioritize" }
);
