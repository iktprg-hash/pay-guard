import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  getUserSubscription,
  isActivePro,
} from "@/lib/auth/subscription";

/** Aktuální subscription tier přihlášeného uživatele */
export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const subscription = await getUserSubscription(auth.user.id);

  return NextResponse.json({
    tier: subscription.tier,
    pro: isActivePro(subscription),
    expiresAt: subscription.expiresAt,
  });
}
