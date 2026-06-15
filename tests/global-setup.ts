import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const root = process.cwd();
const manifestPath = join(root, ".next", "dev", "prerender-manifest.json");

function isDevCacheCorrupt(): boolean {
  if (!existsSync(manifestPath)) return false;
  try {
    JSON.parse(readFileSync(manifestPath, "utf8"));
    return false;
  } catch {
    return true;
  }
}

const cacheFix = "npm run dev:restart";

/** Fail fast when dev server is down or returning 5xx (stale .next cache). */
export default async function globalSetup(): Promise<void> {
  if (isDevCacheCorrupt()) {
    throw new Error(
      [
        "E2E preflight: corrupted Turbopack cache (.next/dev/prerender-manifest.json).",
        "This causes HTTP 500 on all pages (JSON parse error at ~820).",
        `Fix: ${cacheFix}`,
      ].join("\n")
    );
  }

  const healthUrl = `${baseURL}/api/health`;

  let res: Response;
  try {
    res = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error(
      [
        `E2E preflight: cannot reach ${healthUrl}.`,
        "Start the app first:",
        `  ${cacheFix}`,
      ].join("\n")
    );
  }

  if (!res.ok) {
    throw new Error(
      [
        `E2E preflight: ${healthUrl} returned HTTP ${res.status}.`,
        "Restart with a clean cache:",
        `  ${cacheFix}`,
      ].join("\n")
    );
  }

  const body = (await res.json()) as { ok?: boolean };
  if (!body.ok) {
    throw new Error(`E2E preflight: ${healthUrl} returned ok=false.`);
  }
}
