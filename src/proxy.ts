import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/** Locale negotiation + redirects/rewrites for cs/ru/en (Next.js 16 proxy). */
export default createMiddleware(routing);

export const config = {
  // Skip /api, /_next, /_vercel, and static files (e.g. favicon.ico).
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
