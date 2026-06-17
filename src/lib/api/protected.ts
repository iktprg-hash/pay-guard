import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { rateLimitError } from "@/lib/api/errors";
import { requireProApiUser } from "@/lib/auth/require-pro";
import { requireApiUser } from "@/lib/auth/session";
import {
  AUTHENTICATED_RATE_LIMITS,
  checkAuthenticatedRateLimit,
} from "@/lib/security/authenticated-rate-limit";
import {
  checkProRateLimit,
  PRO_RATE_LIMITS,
  type ProRateLimitAction,
} from "@/lib/security/pro-rate-limit";
import { getClientIp } from "@/lib/security/rateLimit";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";

/** Authenticated user available after successful route protection. */
export interface ProtectedRouteContext {
  user: User;
}

export type AuthenticatedRateLimitPreset = keyof typeof AUTHENTICATED_RATE_LIMITS;

/** Custom per-route limit (userId ceiling + userId+IP, same as authenticated APIs). */
export interface CustomRateLimitOption {
  scope: string;
  limit: number;
  windowMs?: number;
}

/**
 * Rate limit configuration:
 * - Pro action string → Pro bucket (e.g. `"pdf"`)
 * - Authenticated preset → `"chat"` | `"prioritize"`
 * - Custom object → arbitrary scope/limit
 */
export type RateLimitOption =
  | ProRateLimitAction
  | AuthenticatedRateLimitPreset
  | CustomRateLimitOption;

export interface ProtectionOptions {
  /** When true, requires active Pro subscription (403 otherwise). */
  requirePro?: boolean;
  /** Rate limit applied after auth (and Pro) checks. */
  rateLimit?: RateLimitOption;
}

export type ProtectionResult =
  | { ok: true; user: User }
  | { ok: false; response: Response };

/** Next.js App Router context passed as the second argument to route handlers. */
export type AppRouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

export type ProtectedRouteHandler<RouteContext = AppRouteContext> = (
  request: NextRequest,
  context: ProtectedRouteContext,
  routeContext: RouteContext
) => Promise<Response> | Response;

function isProRateLimitAction(value: string): value is ProRateLimitAction {
  return value in PRO_RATE_LIMITS;
}

function isAuthenticatedPreset(
  value: string
): value is AuthenticatedRateLimitPreset {
  return value in AUTHENTICATED_RATE_LIMITS;
}

function isCustomRateLimit(option: RateLimitOption): option is CustomRateLimitOption {
  return typeof option === "object" && option !== null && "scope" in option;
}

/**
 * Applies configured rate limit after auth. Uses Pro buckets or authenticated-style limits.
 */
export async function applyRouteRateLimit(
  headers: Headers,
  userId: string,
  rateLimit: RateLimitOption
): Promise<ProtectionResult | { ok: true }> {
  const ip = getClientIp(headers);

  if (typeof rateLimit === "string") {
    if (isProRateLimitAction(rateLimit)) {
      const result = await checkProRateLimit(rateLimit, userId, ip);
      if (!result.allowed) {
        return { ok: false, response: rateLimitError(result.resetAt) };
      }
      return { ok: true };
    }

    if (isAuthenticatedPreset(rateLimit)) {
      const preset = AUTHENTICATED_RATE_LIMITS[rateLimit];
      const result = await checkAuthenticatedRateLimit(
        rateLimit,
        userId,
        ip,
        preset.limit,
        preset.windowMs
      );
      if (!result.allowed) {
        return { ok: false, response: rateLimitError(result.resetAt) };
      }
      return { ok: true };
    }
  }

  if (isCustomRateLimit(rateLimit)) {
    const result = await checkAuthenticatedRateLimit(
      rateLimit.scope,
      userId,
      ip,
      rateLimit.limit,
      rateLimit.windowMs ?? 60_000
    );
    if (!result.allowed) {
      return { ok: false, response: rateLimitError(result.resetAt) };
    }
    return { ok: true };
  }

  return { ok: true };
}

/**
 * Core protection pipeline: auth → optional Pro → optional rate limit.
 * Use from Route Handlers, or call with `request.headers` from Server Actions.
 */
export async function runRouteProtection(
  headers: Headers,
  options: ProtectionOptions = {}
): Promise<ProtectionResult> {
  const auth = options.requirePro
    ? await requireProApiUser()
    : await requireApiUser();

  if ("error" in auth) {
    return { ok: false, response: auth.error };
  }

  if (options.rateLimit) {
    const limited = await applyRouteRateLimit(
      headers,
      auth.user.id,
      options.rateLimit
    );
    if (!limited.ok) return limited;
  }

  return { ok: true, user: auth.user };
}

/** Convenience wrapper around `runRouteProtection(request, options)`. */
export async function runRouteProtectionForRequest(
  request: NextRequest,
  options: ProtectionOptions = {}
): Promise<ProtectionResult> {
  return runRouteProtection(request.headers, options);
}

/**
 * Factory for protected App Router handlers.
 *
 * @example
 * export const POST = createProtectedHandler(
 *   { requirePro: true, rateLimit: "pdf" },
 *   async (request, { user }) => NextResponse.json({ userId: user.id })
 * );
 */
export function createProtectedHandler<RouteContext = AppRouteContext>(
  options: ProtectionOptions,
  handler: ProtectedRouteHandler<RouteContext>
): (request: NextRequest, routeContext: RouteContext) => Promise<Response> {
  return async (request: NextRequest, routeContext: RouteContext) => {
    const guard = await runRouteProtectionForRequest(request, options);
    if (!guard.ok) return guard.response;

    return handler(request, { user: guard.user }, routeContext);
  };
}

/** Authenticated route (401 without session). */
export function withAuth<RouteContext = AppRouteContext>(
  handler: ProtectedRouteHandler<RouteContext>,
  options: Omit<ProtectionOptions, "requirePro"> = {}
): (request: NextRequest, routeContext: RouteContext) => Promise<Response> {
  return createProtectedHandler({ ...options, requirePro: false }, handler);
}

/** Authenticated + Pro route (401 / 403) with optional Pro or custom rate limit. */
export function withProProtection<RouteContext = AppRouteContext>(
  handler: ProtectedRouteHandler<RouteContext>,
  options: Omit<ProtectionOptions, "requirePro"> = {}
): (request: NextRequest, routeContext: RouteContext) => Promise<Response> {
  return createProtectedHandler({ ...options, requirePro: true }, handler);
}

export type PublicAuthRouteHandler = (
  request: NextRequest,
  routeContext: AppRouteContext
) => Promise<Response> | Response;

/**
 * IP (+ optional email) rate limit for public auth endpoints.
 * Returns a Response on 429, otherwise `{ ok: true }`.
 */
export async function applyPublicAuthRateLimit(
  request: NextRequest,
  action: string,
  email?: string,
  options?: { skipIp?: boolean }
): Promise<ProtectionResult | { ok: true }> {
  const limited = await enforceAuthRateLimit(request, action, email, options);
  if (limited) return { ok: false, response: limited };
  return { ok: true };
}

/** Public auth route with entry rate limit (logout, confirm, etc.). */
export function withPublicAuthRateLimit(
  action: string,
  handler: PublicAuthRouteHandler,
  options?: { skipIp?: boolean }
): (request: NextRequest, routeContext: AppRouteContext) => Promise<Response> {
  return async (request, routeContext) => {
    const limited = await applyPublicAuthRateLimit(
      request,
      action,
      undefined,
      options
    );
    if (!limited.ok) return limited.response;
    return handler(request, routeContext);
  };
}

/**
 * Server Actions helper — same auth/Pro/RL pipeline without a Route Handler.
 * Throws `RouteProtectionError` with a ready Response for `catch` at the call site.
 *
 * @example
 * export async function myAction() {
 *   const { user } = await assertProtectedAction({ requirePro: true });
 * }
 */
export class RouteProtectionError extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super("Route protection failed");
    this.name = "RouteProtectionError";
    this.response = response;
  }
}

export async function assertProtectedAction(
  options: ProtectionOptions = {}
): Promise<ProtectedRouteContext> {
  const { headers } = await import("next/headers");
  const headerStore = await headers();
  const guard = await runRouteProtection(headerStore, options);

  if (!guard.ok) {
    throw new RouteProtectionError(guard.response);
  }

  return { user: guard.user };
}
