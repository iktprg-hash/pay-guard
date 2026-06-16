import { runE2ePreflight } from "./helpers/e2e-preflight";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Fail fast when dev server is down, cache is corrupt, or routes return 404/5xx.
 * Skip when Playwright will boot webServer after globalSetup (preflight would run too early).
 * Local/CI use `test:e2e:local` which runs preflight CLI first and sets E2E_PREFLIGHT_DONE=1.
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
