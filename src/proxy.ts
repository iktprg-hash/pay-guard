import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getSecurityHeaders } from "@/lib/security/headers";
import { randomBytes } from "crypto";

const intlMiddleware = createMiddleware(routing);

/** Locale negotiation + per-request CSP nonce (Next.js 16 proxy). */
export default function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const intlRequest = new NextRequest(request.url, {
    headers: requestHeaders,
    method: request.method,
  });

  const response = intlMiddleware(intlRequest);

  for (const { key, value } of getSecurityHeaders({ nonce })) {
    response.headers.set(key, value);
  }

  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  // Skip /api, /_next, /_vercel, and static files (e.g. favicon.ico).
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
