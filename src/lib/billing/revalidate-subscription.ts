import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";

const SUBSCRIPTION_PATHS = ["/pro/dashboard", "/pricing"] as const;

/** Bust Next.js cache for subscription-sensitive pages (all locales). */
export function revalidateSubscriptionPages(): void {
  for (const locale of routing.locales) {
    for (const path of SUBSCRIPTION_PATHS) {
      revalidatePath(`/${locale}${path}`);
    }
  }
}
