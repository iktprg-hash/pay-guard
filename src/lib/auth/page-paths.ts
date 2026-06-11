/** Veřejné stránky bez přihlášení */
const PUBLIC_SUFFIXES = [
  "/login",
  "/register",
  "/pricing",
  "/forgot-password",
  "/reset-password",
] as const;

/** Po přihlášení sem nepatří (redirect na home) */
const GUEST_ONLY_SUFFIXES = [
  "/login",
  "/register",
  "/forgot-password",
] as const;

export function isPublicPagePath(pathname: string): boolean {
  return PUBLIC_SUFFIXES.some((suffix) => pathname.includes(suffix));
}

export function isGuestOnlyPagePath(pathname: string): boolean {
  return GUEST_ONLY_SUFFIXES.some((suffix) => pathname.endsWith(suffix));
}
