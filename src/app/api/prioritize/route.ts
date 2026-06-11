import { NextRequest, NextResponse } from "next/server";
import { runPriorityEngine } from "@/services/priorityEngine";
import { requireApiUser } from "@/lib/auth/session";
import { rateLimitError, validationError } from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
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

  const body = await request.json().catch(() => null);
  const parsed = prioritizeRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { profile, locale } = parsed.data;
    const result = runPriorityEngine(normalizeProfile(profile), locale);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/prioritize]", error);
    return NextResponse.json(
      { error: "Prioritization failed" },
      { status: 500 }
    );
  }
}
