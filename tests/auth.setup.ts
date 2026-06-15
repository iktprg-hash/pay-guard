import { test as setup } from "@playwright/test";
import {
  E2E_LOCALE,
  ensureAuthDir,
  getTestUserCredentials,
  saveAuthenticatedStorageState,
} from "./fixtures/auth";

setup.describe.configure({ mode: "serial" });

setup("prepare auth storage directory", async () => {
  ensureAuthDir();
});

setup("authenticate free test user", async ({ request, baseURL }) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required for auth setup.");
  }

  const health = await request.get(`${baseURL}/api/health`);
  const healthBody = (await health.json()) as { supabase?: boolean };

  if (!healthBody.supabase) {
    setup.skip(
      true,
      "Supabase is not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart npm run dev."
    );
    return;
  }

  const credentials = getTestUserCredentials();
  await saveAuthenticatedStorageState(request, baseURL, credentials);

  setup.info().annotations.push({
    type: "e2e-user",
    description: `${credentials.email} (${E2E_LOCALE})`,
  });
});
