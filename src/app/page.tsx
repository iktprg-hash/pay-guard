import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

/** / → default locale (bez proxy middleware) */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
