import { isDevCacheCorrupt, DEV_CACHE_FIX_HINT } from "./dev-cache";

const DEFAULT_BASE = "http://127.0.0.1:3000";

function fail(lines: string[]): never {
  throw new Error(lines.join("\n"));
}

async function fetchProbe(
  url: string,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (cause) {
    fail(
      [
        `E2E preflight: cannot reach ${url}.`,
        "Start the app first:",
        `  ${DEV_CACHE_FIX_HINT}`,
        cause instanceof Error ? `(${cause.message})` : "",
      ].filter(Boolean)
    );
  }
}

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

async function waitForHealth(
  baseURL: string,
  attempts = 30,
  delayMs = 2000
): Promise<void> {
  const healthUrl = `${baseURL}/api/health`;
  const isCi = Boolean(process.env.CI);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(healthUrl, {
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
        if (body.ok) return;
      }
    } catch {
      // server still booting
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  fail(
    [
      `E2E preflight: ${healthUrl} not ready after ${attempts} attempts.`,
      isCi
        ? "In CI, start the server in the same step as preflight (background jobs do not survive across GitHub Actions steps)."
        : "Dev may be stuck (EMFILE / corrupt .next).",
      isCi
        ? "Fix: run `npm run start:prod &` then preflight in one shell step."
        : `Fix: ulimit -n 10240 && ${DEV_CACHE_FIX_HINT}`,
    ].filter(Boolean)
  );
}

/** Cache integrity + critical route readiness before E2E. */
export async function runE2ePreflight(
  baseURL = process.env.E2E_BASE_URL ?? DEFAULT_BASE
): Promise<void> {
  if (isDevCacheCorrupt()) {
    fail([
      "E2E preflight: corrupted Turbopack cache (.next/dev/prerender-manifest.json).",
      "This causes HTTP 404/500 on pages and API routes.",
      `Fix: ${DEV_CACHE_FIX_HINT}`,
    ]);
  }

  const attempts = process.env.CI ? 60 : 30;
  await waitForHealth(baseURL, attempts);

  const healthUrl = `${baseURL}/api/health`;
  const healthRes = await fetchProbe(healthUrl);
  if (!healthRes.ok) {
    fail([
      `E2E preflight: ${healthUrl} returned HTTP ${healthRes.status}.`,
      `Fix: ${DEV_CACHE_FIX_HINT}`,
    ]);
  }

  const healthBody = (await healthRes.json().catch(() => ({}))) as {
    ok?: boolean;
  };
  if (!healthBody.ok) {
    fail([
      `E2E preflight: ${healthUrl} returned ok=false.`,
      `Fix: ${DEV_CACHE_FIX_HINT}`,
    ]);
  }

  const loginUrl = `${baseURL}/cs/login`;
  const loginRes = await fetchProbe(loginUrl);
  if (!loginRes.ok) {
    const snippet = (await loginRes.text())
      .slice(0, 180)
      .replace(/\s+/g, " ");
    fail(
      [
        `E2E preflight: ${loginUrl} returned HTTP ${loginRes.status}.`,
        "Dev server is up but app routes are broken (stale/corrupt .next).",
        snippet ? `Body: ${snippet}` : "",
        `Fix: ${DEV_CACHE_FIX_HINT}`,
      ].filter(Boolean)
    );
  }

  const otpUrl = `${baseURL}/api/auth/send-otp`;
  if (!isSupabaseConfigured()) {
    if (process.env.CI) {
      console.warn(
        "E2E preflight: skipping send-otp probe — Supabase secrets not configured in CI."
      );
      return;
    }
  }

  const otpRes = await fetchProbe(otpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "e2e-preflight@pay-guard.test" }),
  });
  if (!otpRes.ok) {
    fail([
      `E2E preflight: ${otpUrl} returned HTTP ${otpRes.status}.`,
      `Fix: ${DEV_CACHE_FIX_HINT}`,
    ]);
  }

  const otpBody = (await otpRes.json().catch(() => ({}))) as { ok?: boolean };
  if (otpBody.ok !== true) {
    fail([
      `E2E preflight: ${otpUrl} did not return { ok: true }.`,
      `Fix: ${DEV_CACHE_FIX_HINT}`,
    ]);
  }
}
