import type { NextRequest } from "next/server";

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/** Canonical production origin from env (Vercel / custom domain). */
export function getSiteOriginFromEnv(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && !explicit.includes("your-") && !explicit.includes("localhost")) {
    return normalizeOrigin(explicit);
  }

  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return null;
}

/** Prefer configured site URL; fall back to request origin (dev). */
export function resolveSiteOrigin(request: NextRequest): string {
  return getSiteOriginFromEnv() ?? request.nextUrl.origin;
}

/** Auth redirect target on this deployment */
export function authConfirmUrl(request: NextRequest, locale: string, next?: string): string {
  const origin = resolveSiteOrigin(request);
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("locale", locale);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
