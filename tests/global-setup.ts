import { runE2ePreflight } from "./helpers/e2e-preflight";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Fail fast when dev server is down, cache is corrupt, or routes return 404/5xx.
 *
 * - `test:e2e:local` runs preflight CLI first → sets E2E_PREFLIGHT_DONE=1.
 * - `playwright test` with webServer: skip here — Playwright waits on /api/health.
 * - `E2E_NO_WEBSERVER=1` without preflight (e.g. test:e2e:ui): run preflight now.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_PREFLIGHT_DONE === "1") {
    return;
  }
  if (!process.env.E2E_NO_WEBSERVER) {
    return;
  }
  await runE2ePreflight(baseURL);
}
