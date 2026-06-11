import type { Locale } from "@/i18n/routing";

const BLOCKED_NEXT = [
  "manifest.webmanifest",
  ".webmanifest",
  ".json",
  ".xml",
  "/api/",
  "/auth/",
];

/** Bezpečný redirect po přihlášení */
export function resolveAuthNext(
  next: string | null | undefined,
  locale: Locale
): string {
  const fallback = `/${locale}`;

  if (!next || !next.startsWith("/")) return fallback;
  if (!next.startsWith(`/${locale}`) && !next.match(/^\/(cs|ru|en)/)) {
    return fallback;
  }
  if (BLOCKED_NEXT.some((part) => next.includes(part))) return fallback;
  if (next.endsWith("/login") || next.endsWith("/register")) return fallback;

  return next;
}
