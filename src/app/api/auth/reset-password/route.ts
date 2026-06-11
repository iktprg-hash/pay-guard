import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api/errors";
import { authErrorResponse } from "@/lib/auth/errors";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { isStrongPassword } from "@/lib/auth/password";
import { createSessionRouteClient } from "@/lib/auth/supabase-route";

const bodySchema = z.object({
  password: z.string().min(8).max(256),
});

/** Nastaví nové heslo po recovery odkazu */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  if (!isStrongPassword(parsed.data.password)) {
    return authErrorResponse(
      "Password requirements not met",
      400,
      "password_requirements"
    );
  }

  const limited = await enforceAuthRateLimit(request, "reset-password");
  if (limited) return limited;

  const response = NextResponse.json({ ok: true });
  const supabase = createSessionRouteClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return authErrorResponse("Authentication required", 401);
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return authErrorResponse(error.message, 400);
  }

  return response;
}
