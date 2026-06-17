import { NextResponse } from "next/server";
import {
  getUserSubscription,
  isActivePro,
} from "@/lib/auth/subscription";
import { withAuth } from "@/lib/api/protected";
import { validationError } from "@/lib/api/errors";
import { parseQueryParams } from "@/lib/api/parse-request";
import { emptyQuerySchema } from "@/lib/validation/schemas";

/** Aktuální subscription tier přihlášeného uživatele */
export const GET = withAuth(
  async (request, { user }) => {
    const query = parseQueryParams(request, emptyQuerySchema);
    if (!query.ok) return validationError(query.error);

    const subscription = await getUserSubscription(user.id);

    return NextResponse.json({
      tier: subscription.tier,
      pro: isActivePro(subscription),
      isProEnabled: isActivePro(subscription),
      expiresAt: subscription.expiresAt,
    });
  },
  { rateLimit: { scope: "auth-tier", limit: 60 } }
);
