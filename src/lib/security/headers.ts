const isProdBuild = process.env.NODE_ENV === "production";

function stripQuotes(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

export function getSupabaseHost(): string {
  try {
    const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (url && !url.includes("your-project")) {
      return new URL(url).host;
    }
  } catch {
    /* fall through */
  }
  return "*.supabase.co";
}

export interface CspOptions {
  /** false = dev (unsafe-eval for Next/React debugging) */
  production?: boolean;
  supabaseHost?: string;
}

/** Sestaví CSP — v prod bez unsafe-eval (Next.js doporučení) */
export function buildContentSecurityPolicy(options: CspOptions = {}): string {
  const production = options.production ?? isProdBuild;
  const supabaseHost = options.supabaseHost ?? getSupabaseHost();

  const scriptSrc = production
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.x.ai`,
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function getSecurityHeaders(
  options: CspOptions = {}
): { key: string; value: string }[] {
  const production = options.production ?? isProdBuild;

  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(self), geolocation=(), payment=()",
    },
    ...(production
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : []),
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(options),
    },
  ];
}

/** Hlavičky pro next.config — prod CSP při buildu */
export const SECURITY_HEADERS = getSecurityHeaders();
