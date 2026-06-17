import { test as setup } from "@playwright/test";
import {
  E2E_LOCALE,
  elevateTestUserToPro,
  getTestUserCredentials,
} from "./fixtures/auth";

setup.describe.configure({ mode: "serial" });

setup("elevate test user to Pro tier", async ({ request, baseURL }) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required for pro setup.");
  }

  const health = await request.get(`${baseURL}/api/health`);
  const healthBody = (await health.json()) as { supabase?: boolean };

  if (!healthBody.supabase) {
    setup.skip(
      true,
      "Supabase is not configured — Pro E2E tests skipped."
    );
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    setup.skip(
      true,
      "SUPABASE_SERVICE_ROLE_KEY not set — cannot elevate to Pro. Pro E2E tests skipped."
    );
    return;
  }

  const credentials = getTestUserCredentials();
  await elevateTestUserToPro(request, baseURL, credentials);

  setup.info().annotations.push({
    type: "e2e-pro-user",
    description: `${credentials.email} elevated to Pro (${E2E_LOCALE})`,
  });
});
