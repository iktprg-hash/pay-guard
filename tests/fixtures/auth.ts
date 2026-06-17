import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  test as base,
  expect,
  request as playwrightRequest,
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

function createE2eServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("your-project")) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Paginate GoTrue admin users and match email exactly. */
async function resolveTestUserId(email: string): Promise<string | null> {
  const supabase = createE2eServiceClient();
  if (!supabase) return null;

  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return null;

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );
    if (match?.id) return match.id;
    if (data.users.length < 200) break;
  }

  return null;
}

function subscriptionPatchMatches(
  profile: { subscription_tier: string; subscription_expires_at: string | null },
  data: {
    subscription_tier: "free" | "pro" | "pro_max";
    subscription_expires_at: string | null;
  }
): boolean {
  if (profile.subscription_tier !== data.subscription_tier) return false;
  if (data.subscription_expires_at) {
    return Boolean(profile.subscription_expires_at);
  }
  return profile.subscription_expires_at == null;
}

/** Fallback when PostgREST trigger guard blocks service-role REST updates. */
async function patchProfileSubscriptionViaPg(
  userId: string,
  data: {
    subscription_tier: "free" | "pro" | "pro_max";
    subscription_expires_at: string | null;
  }
): Promise<{ subscription_tier: string; subscription_expires_at: string | null } | null> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl || databaseUrl.includes("[PASSWORD]")) return null;

  const { spawnSync } = await import("node:child_process");
  const args = [
    "scripts/e2e-patch-profile-subscription.mjs",
    userId,
    data.subscription_tier,
    data.subscription_expires_at ?? "null",
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    const sslHint = stderr.includes("SELF_SIGNED_CERT_IN_CHAIN")
      ? " Run `npm run db:apply:011` first (Supabase pooler SSL is auto-relaxed in scripts)."
      : "";
    throw new Error(
      (stderr || `e2e-patch-profile-subscription exited with ${result.status ?? "unknown"}`) +
        sslHint
    );
  }

  try {
    return JSON.parse(result.stdout.trim()) as {
      subscription_tier: string;
      subscription_expires_at: string | null;
    };
  } catch {
    return null;
  }
}

async function patchProfileSubscription(
  userId: string,
  data: {
    subscription_tier: "free" | "pro" | "pro_max";
    subscription_expires_at: string | null;
  }
): Promise<{ subscription_tier: string; subscription_expires_at: string | null }> {
  const supabase = createE2eServiceClient();
  if (!supabase) {
    throw new Error("Supabase service role is required to patch subscription tier");
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", userId)
    .select("subscription_tier, subscription_expires_at");

  if (error) {
    throw new Error(`profile subscription patch failed: ${error.message}`);
  }

  if (updated?.length) {
    const row = updated[0] as {
      subscription_tier: string;
      subscription_expires_at: string | null;
    };
    if (subscriptionPatchMatches(row, data)) return row;
  }

  const { data: inserted, error: upsertError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      locale: E2E_LOCALE,
      ...data,
    })
    .select("subscription_tier, subscription_expires_at")
    .single();

  if (!upsertError && inserted) {
    const row = inserted as {
      subscription_tier: string;
      subscription_expires_at: string | null;
    };
    if (subscriptionPatchMatches(row, data)) return row;
  }

  const pgRow = await patchProfileSubscriptionViaPg(userId, data);
  if (pgRow && subscriptionPatchMatches(pgRow, data)) {
    return pgRow;
  }

  const viaRest = updated?.[0] ?? inserted;
  throw new Error(
    `profile subscription patch blocked by guard trigger (got tier=${viaRest?.subscription_tier ?? "unknown"}). ` +
      "Apply migration 011_fix_subscription_guard_service_role.sql (`npm run db:apply`) " +
      "or set DATABASE_URL in .env.local for E2E pg fallback."
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveProjectStoragePath(
  projectStorageState: string | undefined
): string | undefined {
  if (
    typeof projectStorageState === "string" &&
    fs.existsSync(projectStorageState)
  ) {
    return projectStorageState;
  }
  if (fs.existsSync(FREE_USER_STORAGE)) return FREE_USER_STORAGE;
  return undefined;
}

async function readProfileTierFromDb(userId: string): Promise<{
  subscription_tier: string;
  subscription_expires_at: string | null;
} | null> {
  const supabase = createE2eServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();

  return data ?? null;
}

/** Poll /api/auth/tier until Pro is visible or timeout (handles post-patch lag). */
async function pollAuthTierPro(
  baseURL: string,
  storagePath: string,
  timeoutMs = 10_000
): Promise<{ pro: boolean; tier?: string }> {
  const deadline = Date.now() + timeoutMs;
  let last: { pro: boolean; tier?: string } = { pro: false };

  while (Date.now() < deadline) {
    const context = await playwrightRequest.newContext({
      baseURL,
      storageState: storagePath,
    });
    try {
      const tierRes = await context.get("/api/auth/tier");
      if (tierRes.ok()) {
        const body = (await tierRes.json()) as { pro?: boolean; tier?: string };
        last = { pro: Boolean(body.pro), tier: body.tier };
        if (body.pro) return last;
      }
    } finally {
      await context.dispose();
    }
    await sleep(500);
  }

  return last;
}

/**
 * Fallback when tier API lags: annotate storage state for E2E (localStorage marker).
 * Pro UI/API still reads DB — marker helps debugging only.
 */
function annotateProStorageMock(storagePath: string): void {
  if (!fs.existsSync(storagePath)) return;

  const state = JSON.parse(fs.readFileSync(storagePath, "utf8")) as {
    origins?: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
  };

  const baseOrigin =
    process.env.E2E_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://127.0.0.1:3000";
  const origin = baseOrigin.replace(/\/$/, "");

  const origins = state.origins ?? [];
  let entry = origins.find((item) => item.origin === origin);
  if (!entry) {
    entry = { origin, localStorage: [] };
    origins.push(entry);
  }

  const marker = { name: "e2e-pro-tier-mock", value: "1" };
  if (!entry.localStorage.some((item) => item.name === marker.name)) {
    entry.localStorage.push(marker);
  }

  state.origins = origins;
  fs.writeFileSync(storagePath, JSON.stringify(state, null, 2));
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

async function loginViaApiWithRetry(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials,
  attempts = 5
) {
  let lastRes = await loginViaApi(request, baseURL, credentials);

  for (let attempt = 2; attempt <= attempts; attempt += 1) {
    if (lastRes.ok()) return lastRes;

    const retryable = await (async () => {
      if (lastRes.status() === 429) return true;
      if (lastRes.status() !== 401) return false;
      try {
        const body = (await lastRes.json()) as { code?: string };
        return body.code === "rate_limited";
      } catch {
        return false;
      }
    })();

    if (!retryable) return lastRes;

    await sleep(Math.min(1500 * attempt, 8000));
    lastRes = await loginViaApi(request, baseURL, credentials);
  }

  return lastRes;
}

async function tryReuseStorageState(
  baseURL: string,
  storagePath: string
): Promise<boolean> {
  if (!fs.existsSync(storagePath)) return false;

  const context = await playwrightRequest.newContext({
    baseURL,
    storageState: storagePath,
  });

  try {
    const res = await context.get("/api/auth/tier");
    return res.ok();
  } finally {
    await context.dispose();
  }
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

async function hasAuthenticatedSession(
  request: APIRequestContext,
  baseURL: string
): Promise<boolean> {
  const tierRes = await request.get(`${baseURL}/api/auth/tier`);
  return tierRes.ok();
}

/**
 * Idempotent test user bootstrap:
 * 1. Try login
 * 2. Register on failure, then login again (skip login if register already set session cookies)
 */
export async function ensureTestUser(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials = getTestUserCredentials()
): Promise<void> {
  const existingUserId = await resolveTestUserId(credentials.email);
  let loginRes = await loginViaApiWithRetry(request, baseURL, credentials);

  if (loginRes.ok()) {
    await ensureFreeSubscriptionTier(request, credentials);
    return;
  }

  if (existingUserId) {
    throw new Error(
      `E2E login failed for existing user (${loginRes.status()}): ${await loginRes.text()}`
    );
  }

  const registerRes = await registerViaApi(request, baseURL, credentials);

  if (!registerRes.ok()) {
    const registerBody = await registerRes.text();
    const retryLogin = await loginViaApiWithRetry(request, baseURL, credentials);
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

  if (await hasAuthenticatedSession(request, baseURL)) {
    await ensureFreeSubscriptionTier(request, credentials);
    return;
  }

  loginRes = await loginViaApiWithRetry(request, baseURL, credentials);
  if (!loginRes.ok()) {
    const loginBody = await loginRes.text();
    const hint =
      loginRes.status() === 503
        ? " Supabase is not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart dev."
        : loginRes.status() === 429
          ? " Auth rate limit — rebuild (npm run build) and rerun ci-e2e so E2E_DISABLE_AUTH_RATE_LIMIT applies to start:prod."
          : "";
    throw new Error(
      `E2E login after register failed (${loginRes.status()}): ${loginBody}.${hint}`
    );
  }

  await ensureFreeSubscriptionTier(request, credentials);
}

/** Reset E2E user to free tier when service role is available (PDF API checks DB). */
export async function ensureFreeSubscriptionTier(
  _request: APIRequestContext,
  credentials: TestCredentials = getTestUserCredentials()
): Promise<void> {
  const userId = await resolveTestUserId(credentials.email);
  if (!userId) return;

  try {
    await patchProfileSubscription(userId, {
      subscription_tier: "free",
      subscription_expires_at: null,
    });
  } catch {
    // Best-effort reset when service role is misconfigured in local runs.
  }
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

  if (await tryReuseStorageState(baseURL, storagePath)) {
    await ensureFreeSubscriptionTier(request, credentials);
    return;
  }

  await ensureTestUser(request, baseURL, credentials);
  await request.storageState({ path: storagePath });
}

export const PRO_USER_STORAGE = path.join(AUTH_DIR, "pro-user.json");

/** Elevate E2E user to Pro tier (requires SUPABASE_SERVICE_ROLE_KEY). */
export async function ensureProSubscriptionTier(
  _request: APIRequestContext,
  credentials: TestCredentials = getTestUserCredentials()
): Promise<void> {
  if (!createE2eServiceClient()) return;

  const userId = await resolveTestUserId(credentials.email);
  if (!userId) {
    throw new Error(
      `ensureProSubscriptionTier: auth user not found for ${credentials.email}`
    );
  }

  const expiresAt = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000
  ).toISOString();

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const profile = await patchProfileSubscription(userId, {
        subscription_tier: "pro",
        subscription_expires_at: expiresAt,
      });

      if (
        profile.subscription_tier !== "pro" ||
        !profile.subscription_expires_at
      ) {
        throw new Error(
          `ensureProSubscriptionTier did not persist Pro tier for ${credentials.email} (userId=${userId}, tier=${profile.subscription_tier ?? "unknown"})`
        );
      }

      return;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));
      if (attempt < 3) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError ?? new Error("ensureProSubscriptionTier failed");
}

/** Elevate test user to Pro and persist pro storage state (pro.setup entry point). */
export async function elevateTestUserToPro(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials = getTestUserCredentials()
): Promise<void> {
  await saveProStorageState(request, baseURL, credentials);
}

/** Save authenticated storage state for Pro user (same credentials, elevated tier). */
export async function saveProStorageState(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials = getTestUserCredentials()
): Promise<void> {
  ensureAuthDir();

  await ensureProSubscriptionTier(request, credentials);

  const userId = await resolveTestUserId(credentials.email);

  if (fs.existsSync(FREE_USER_STORAGE)) {
    fs.copyFileSync(FREE_USER_STORAGE, PRO_USER_STORAGE);
  }

  const loginRes = await loginViaApiWithRetry(request, baseURL, credentials);
  if (loginRes.ok()) {
    await request.storageState({ path: PRO_USER_STORAGE });
  } else if (!fs.existsSync(PRO_USER_STORAGE)) {
    throw new Error(
      `Pro E2E login failed (${loginRes.status()}): ${await loginRes.text()}`
    );
  }

  let tier = await pollAuthTierPro(baseURL, PRO_USER_STORAGE, 10_000);

  if (!tier.pro && userId) {
    const dbProfile = await readProfileTierFromDb(userId);
    const dbPro =
      dbProfile?.subscription_tier === "pro" &&
      Boolean(dbProfile.subscription_expires_at);

    if (dbPro) {
      const refreshLogin = await loginViaApiWithRetry(
        request,
        baseURL,
        credentials
      );
      if (refreshLogin.ok()) {
        await request.storageState({ path: PRO_USER_STORAGE });
      }
      tier = await pollAuthTierPro(baseURL, PRO_USER_STORAGE, 5_000);
    }

    if (!tier.pro && dbPro) {
      annotateProStorageMock(PRO_USER_STORAGE);
      console.warn(
        "[e2e] tier API lag after DB Pro elevation — continuing with pro storage mock marker"
      );
      return;
    }
  }

  if (!tier.pro) {
    throw new Error(
      `Pro E2E user is not Pro after elevation (tier=${tier.tier ?? "unknown"})`
    );
  }
}

/** Re-login when storageState cookies are stale; persist refreshed cookies for page tests. */
export async function refreshAuthenticatedApiSession(
  request: APIRequestContext,
  baseURL: string,
  credentials: TestCredentials = getTestUserCredentials(),
  storagePath?: string
): Promise<void> {
  const tierOk = async () => {
    const res = await request.get("/api/auth/tier");
    return res.ok();
  };

  if (await tierOk()) return;

  const loginRes = await loginViaApiWithRetry(request, baseURL, credentials);
  if (!loginRes.ok()) {
    throw new Error(
      `E2E API re-login failed (${loginRes.status()}): ${await loginRes.text()}`
    );
  }

  if (!(await tierOk())) {
    throw new Error("E2E tier still unauthenticated after API re-login");
  }

  if (storagePath) {
    await persistRequestStorageState(request, storagePath);
  }
}

async function persistRequestStorageState(
  request: APIRequestContext,
  storagePath: string
): Promise<void> {
  ensureAuthDir();
  const tmpPath = `${storagePath}.${process.pid}.${Date.now()}.tmp`;
  await request.storageState({ path: tmpPath });
  fs.renameSync(tmpPath, storagePath);
}

/** One login refresh per storage file across parallel tests (avoids auth rate limits). */
const storageRefreshLocks = new Map<string, Promise<void>>();

async function ensureStorageStateFresh(
  baseURL: string,
  storagePath: string,
  credentials: TestCredentials = getTestUserCredentials()
): Promise<void> {
  if (await tryReuseStorageState(baseURL, storagePath)) return;

  let refresh = storageRefreshLocks.get(storagePath);
  if (!refresh) {
    refresh = (async () => {
      const context = await playwrightRequest.newContext({
        baseURL,
        storageState: storagePath,
      });
      try {
        await refreshAuthenticatedApiSession(
          context,
          baseURL,
          credentials,
          storagePath
        );
      } finally {
        await context.dispose();
      }
    })();
    storageRefreshLocks.set(storagePath, refresh);
  }

  try {
    await refresh;
  } finally {
    if (storageRefreshLocks.get(storagePath) === refresh) {
      storageRefreshLocks.delete(storagePath);
    }
  }

  if (!(await tryReuseStorageState(baseURL, storagePath))) {
    throw new Error(
      `E2E storage state still invalid after refresh: ${storagePath}`
    );
  }
}

/** Copy refreshed API session cookies into the page browser context. */
export async function syncPageCookiesFromRequest(
  page: Page,
  request: APIRequestContext
): Promise<void> {
  const { cookies } = await request.storageState();
  if (cookies.length === 0) return;
  await page.context().addCookies(cookies);
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
 * Authenticated Playwright test — request fixture loads project storageState cookies.
 * Import this `test` in checkout/pro-gating/pro-features specs instead of @playwright/test.
 */
export const test = base.extend<{
  guestRequest: APIRequestContext;
}>({
  request: async ({ playwright, baseURL }, use, testInfo) => {
    const storagePath = resolveProjectStoragePath(
      testInfo.project.use.storageState as string | undefined
    );

    if (storagePath && baseURL) {
      await ensureStorageStateFresh(baseURL, storagePath);
    }

    const context = await playwright.request.newContext({
      baseURL,
      ...(storagePath ? { storageState: storagePath } : {}),
    });

    try {
      await use(context);
    } finally {
      await context.dispose();
    }
  },
  guestRequest: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });

    try {
      await use(context);
    } finally {
      await context.dispose();
    }
  },
});

export { expect };
