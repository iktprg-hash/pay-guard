import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Prevents caching of live infrastructure probe results. */
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

type HealthCheckStatus = "ok" | "error" | "unconfigured";

interface ProbeResult {
  status: HealthCheckStatus;
  latencyMs?: number;
}

interface DeepHealthResponse {
  ok: boolean;
  checks: {
    supabase: HealthCheckStatus;
    upstash: HealthCheckStatus;
  };
  latencyMs: {
    supabase?: number;
    upstash?: number;
  };
}

/**
 * Parses `Authorization: Bearer <token>` (case-insensitive scheme).
 * Returns null when the header is missing or not a Bearer token.
 */
function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;

  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

/**
 * Deep health probes Supabase and Upstash — must not be public in production.
 * When `HEALTH_DEEP_TOKEN` is set, callers must send `Authorization: Bearer <token>`.
 * When unset, the route stays open for local development only.
 */
function unauthorizedHealthResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Unauthorized",
      message: "Invalid or missing health token",
    },
    { status: 401, headers: NO_STORE_HEADERS }
  );
}

/**
 * Service-role Supabase client for infra probes (no cookies, bypasses RLS).
 * Returns null when URL or service role key is not configured.
 */
function createHealthSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verifies Postgres/API reachability via a minimal service-role query.
 * Uses service role so the probe is independent of user sessions and RLS policies.
 */
async function probeSupabase(): Promise<ProbeResult> {
  const supabase = createHealthSupabaseClient();
  if (!supabase) return { status: "unconfigured" };

  const startedAt = Date.now();

  try {
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    return {
      status: error ? "error" : "ok",
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
    };
  }
}

/**
 * Pings Upstash Redis when REST credentials are present.
 * Config-only checks are insufficient — we need a real round-trip.
 */
async function probeUpstash(): Promise<ProbeResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) return { status: "unconfigured" };

  const startedAt = Date.now();

  try {
    const redis = new Redis({ url, token });
    const pong = await redis.ping();

    return {
      status: pong === "PONG" ? "ok" : "error",
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
    };
  }
}

/**
 * Deep liveness — verifies Supabase connectivity and Upstash Redis.
 * Authorization runs first; failed auth never hits external dependencies.
 */
export async function GET(request: NextRequest) {
  const expectedToken = process.env.HEALTH_DEEP_TOKEN?.trim();

  if (expectedToken) {
    const token = parseBearerToken(request.headers.get("authorization"));

    if (!token || token !== expectedToken) {
      return unauthorizedHealthResponse();
    }
  }

  const [supabaseProbe, upstashProbe] = await Promise.all([
    probeSupabase(),
    probeUpstash(),
  ]);

  const result: DeepHealthResponse = {
    ok: supabaseProbe.status !== "error" && upstashProbe.status !== "error",
    checks: {
      supabase: supabaseProbe.status,
      upstash: upstashProbe.status,
    },
    latencyMs: {
      ...(supabaseProbe.latencyMs !== undefined
        ? { supabase: supabaseProbe.latencyMs }
        : {}),
      ...(upstashProbe.latencyMs !== undefined
        ? { upstash: upstashProbe.latencyMs }
        : {}),
    },
  };

  const status = result.ok ? 200 : 503;

  return NextResponse.json(result, { status, headers: NO_STORE_HEADERS });
}
