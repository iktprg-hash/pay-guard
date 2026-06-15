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

  const credentials = getTestUserCredentials();
  await saveAuthenticatedStorageState(request, baseURL, credentials);

  setup.info().annotations.push({
    type: "e2e-user",
    description: `${credentials.email} (${E2E_LOCALE})`,
  });
});
