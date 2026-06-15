import fs from "node:fs";
import path from "node:path";
import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

export const E2E_LOCALE = process.env.E2E_LOCALE ?? "cs";
export const AUTH_DIR = path.join(process.cwd(), "playwright", ".auth");
export const FREE_USER_STORAGE = path.join(AUTH_DIR, "user.json");

export interface TestCredentials {
  email: string;
  password: string;
}

/** Canonical E2E credentials — override via env (see .env.test.example). */
export function getTestUserCredentials(): TestCredentials {
  return {
    email: process.env.E2E_FREE_USER_EMAIL ?? "e2e-free@pay-guard.test",
    password: process.env.E2E_FREE_USER_PASSWORD ?? "E2eTestPass1",
  };
}

/** @deprecated Use {@link getTestUserCredentials} */
export const getFreeTestCredentials = getTestUserCredentials;

export function ensureAuthDir(): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

async function loginViaApi(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials
) {
  return request.post(`${baseURL}/api/auth/login`, {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });
}

async function registerViaApi(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials
) {
  return request.post(`${baseURL}/api/auth/register`, {
    data: {
      email: credentials.email,
      password: credentials.password,
      locale: E2E_LOCALE,
    },
  });
}

/**
 * Idempotent test user bootstrap:
 * 1. Try login
 * 2. Register on failure, then login again
 */
export async function ensureTestUser(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials = getTestUserCredentials()
): Promise<void> {
  let loginRes = await loginViaApi(request, baseURL, credentials);

  if (loginRes.ok()) {
    await ensureFreeSubscriptionTier(request, credentials);
    return;
  }

  const registerRes = await registerViaApi(request, baseURL, credentials);

  if (!registerRes.ok()) {
    const registerBody = await registerRes.text();
    // User may already exist but password mismatch — surface clearly.
    const retryLogin = await loginViaApi(request, baseURL, credentials);
    if (retryLogin.ok()) {
      await ensureFreeSubscriptionTier(request, credentials);
      return;
    }

    throw new Error(
      `E2E ensureTestUser failed. register=${registerRes.status()} ${registerBody}; ` +
        `login=${retryLogin.status()} ${await retryLogin.text()}. ` +
        "Set AUTH_DEV_REGISTER=1 for local Supabase bypass."
    );
  }

  loginRes = await loginViaApi(request, baseURL, credentials);
  if (!loginRes.ok()) {
    const loginBody = await loginRes.text();
    const hint =
      loginRes.status() === 503
        ? " Supabase is not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart dev."
        : "";
    throw new Error(
      `E2E login after register failed (${loginRes.status()}): ${loginBody}.${hint}`
    );
  }

  await ensureFreeSubscriptionTier(request, credentials);
}

/** Reset E2E user to free tier when service role is available (PDF API checks DB). */
export async function ensureFreeSubscriptionTier(
  request: APIRequestContext,
  credentials: TestCredentials = getTestUserCredentials()
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  const usersRes = await request.get(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(credentials.email)}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    }
  );

  if (!usersRes.ok()) return;

  const usersBody = (await usersRes.json()) as {
    users?: Array<{ id?: string }>;
  };
  const userId = usersBody.users?.[0]?.id;
  if (!userId) return;

  await request.patch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      data: {
        subscription_tier: "free",
        subscription_expires_at: null,
      },
    }
  );
}

/** @deprecated Use {@link ensureTestUser} */
export const ensureFreeUserSession = ensureTestUser;

/** Persist authenticated storage state for Playwright projects. */
export async function saveAuthenticatedStorageState(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials = getTestUserCredentials(),
  storagePath: string = FREE_USER_STORAGE
): Promise<void> {
  ensureAuthDir();
  await ensureTestUser(request, baseURL, credentials);
  await request.storageState({ path: storagePath });
}

/** UI login with email/password (next-intl login form). */
export async function loginWithPassword(
  page: Page,
  credentials: TestCredentials = getTestUserCredentials(),
  locale: string = E2E_LOCALE
): Promise<void> {
  await page.goto(`/${locale}/login`);
  await page.locator("#email").fill(credentials.email);
  await page.locator("#password").fill(credentials.password);
  await page
    .getByRole("button", { name: /sign in|přihlásit|вход/i })
    .click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 20_000,
  });
}

/** UI register with email/password. */
export async function registerWithPassword(
  page: Page,
  credentials: TestCredentials = getTestUserCredentials(),
  locale: string = E2E_LOCALE
): Promise<void> {
  await page.goto(`/${locale}/register`);
  await page.locator("#email").fill(credentials.email);
  await page.locator("#reg-password").fill(credentials.password);
  await page.locator("#reg-confirm").fill(credentials.password);
  await page
    .getByRole("button", { name: /register|registrace|регистрация/i })
    .click();
  await page.waitForURL((url) => !url.pathname.includes("/register"), {
    timeout: 20_000,
  });
}

/**
 * Authenticated Playwright test — reuses storage state from auth.setup.ts.
 * Import this `test` in checkout/pro-gating specs instead of @playwright/test.
 */
export const test = base.extend({
  storageState: FREE_USER_STORAGE,
});

export { expect };
