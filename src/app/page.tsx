import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

/** / → default locale (fallback when proxy does not rewrite) */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
