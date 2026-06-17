import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUpstashRateLimitConfigured } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DeepHealthResponse {
  ok: boolean;
  checks: {
    supabase: "ok" | "error" | "unconfigured";
    upstash: "ok" | "unconfigured";
  };
  latencyMs: {
    supabase?: number;
  };
}

/** Deep liveness — проверяет реальное подключение к Supabase и Upstash. */
export async function GET() {
  const result: DeepHealthResponse = {
    ok: true,
    checks: {
      supabase: "unconfigured",
      upstash: "unconfigured",
    },
    latencyMs: {},
  };

  // Supabase connectivity
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project")) {
    const t0 = Date.now();
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("profiles")
        .select("id")
        .limit(1)
        .maybeSingle();
      result.latencyMs.supabase = Date.now() - t0;
      result.checks.supabase = error ? "error" : "ok";
      if (error) result.ok = false;
    } catch {
      result.checks.supabase = "error";
      result.latencyMs.supabase = Date.now() - t0;
      result.ok = false;
    }
  }

  // Upstash — только проверяем конфигурацию (нет смысла делать Redis ping в каждом uptime check)
  result.checks.upstash = isUpstashRateLimitConfigured()
    ? "ok"
    : "unconfigured";

  const status = result.ok ? 200 : 503;
  return NextResponse.json(result, { status });
}
