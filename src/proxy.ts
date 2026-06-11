import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing, type Locale } from "./i18n/routing";
import { resolveAuthNext } from "@/lib/auth/redirect";
import {
  mergeResponseCookies,
  updateSession,
} from "@/lib/supabase/proxy";

const intlMiddleware = createIntlMiddleware(routing);

/** Skip session refresh for diagnostics */
const PROXY_BYPASS_PREFIXES = ["/api/health"] as const;

function shouldBypassProxy(pathname: string): boolean {
  return PROXY_BYPASS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const PUBLIC_PAGE_SUFFIXES = [
  "/login",
  "/register",
  "/pricing",
  "/forgot-password",
  "/reset-password",
] as const;

/** Stránky / soubory bez přihlášení */
function isPublicAsset(pathname: string): boolean {
  return (
    pathname.includes("manifest.webmanifest") ||
    pathname.startsWith("/~offline")
  );
}

/** API bez auth (login, manifest…) */
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/confirm",
  "/api/auth/forgot-password",
  "/api/health",
  "/api/manifest",
] as const;

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

function extractLocale(pathname: string): Locale {
  const match = pathname.match(/^\/(cs|ru|en)(\/|$)/);
  return (match?.[1] as Locale) ?? routing.defaultLocale;
}

function isPublicPage(pathname: string): boolean {
  const locale = extractLocale(pathname);
  return PUBLIC_PAGE_SUFFIXES.some(
    (suffix) => pathname === `/${locale}${suffix}`
  );
}

function isLocalePage(pathname: string): boolean {
  return /^\/(cs|ru|en)(\/.*)?$/.test(pathname) || pathname === "/";
}

function isProtectedPage(pathname: string): boolean {
  if (!isLocalePage(pathname)) return false;
  return !isPublicPage(pathname);
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (shouldBypassProxy(pathname)) {
    return NextResponse.next({ request });
  }

  try {
    const { supabaseResponse, user } = await updateSession(request);

  // ── API ──
  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return supabaseResponse;
    }
    if (!user) {
      const unauthorized = NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
      return mergeResponseCookies(supabaseResponse, unauthorized);
    }
    return supabaseResponse;
  }

  // ── Auth routes — nechat projít bez refresh session (PKCE cookies)
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next({ request });
  }

  if (isPublicAsset(pathname)) {
    const intlResponse = intlMiddleware(request);
    return mergeResponseCookies(supabaseResponse, intlResponse);
  }

  const locale = extractLocale(pathname);

  // ── Přihlášený → pryč z login/register ──
  if (
    user &&
    (pathname.endsWith("/login") ||
      pathname.endsWith("/register") ||
      pathname.endsWith("/forgot-password"))
  ) {
    const redirect = request.nextUrl.searchParams.get("next");
    const target = resolveAuthNext(redirect, locale);
    return NextResponse.redirect(new URL(target, request.url));
  }

  // ── Nepřihlášený → login ──
  if (!user && isProtectedPage(pathname)) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── i18n routing ──
  const intlResponse = intlMiddleware(request);
  return mergeResponseCookies(supabaseResponse, intlResponse);
  } catch (error) {
    console.error("[proxy] unhandled error:", error);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/",
    "/(cs|ru|en)/:path*",
    "/api/:path*",
    "/auth/:path*",
  ],
};
