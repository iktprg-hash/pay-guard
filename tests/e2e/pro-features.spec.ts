import { test, expect } from "@playwright/test";

/**
 * Pro E2E — тесты для авторизованного Pro-пользователя.
 * Запускается в проекте `chromium-pro` (storageState: pro-user.json).
 */

const LOCALE = process.env.E2E_LOCALE ?? "cs";

test("GET /api/sessions returns 200 for Pro user", async ({ request }) => {
  const res = await request.get("/api/sessions");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { sessions: unknown[] };
  expect(Array.isArray(body.sessions)).toBe(true);
});

test("POST /api/sessions creates session for Pro user", async ({ request }) => {
  const res = await request.post("/api/sessions", {
    data: { locale: LOCALE },
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    sessionId?: string;
    sessionToken?: string;
  };
  expect(typeof body.sessionId).toBe("string");
  expect(body.sessionId!.length).toBeGreaterThan(0);
  expect(typeof body.sessionToken).toBe("string");
  expect(body.sessionToken!.length).toBeGreaterThan(0);
});

test("GET /api/sessions returns list that includes newly created session", async ({
  request,
}) => {
  const createRes = await request.post("/api/sessions", {
    data: { locale: LOCALE },
  });
  expect(createRes.status()).toBe(200);
  const { sessionId } = (await createRes.json()) as { sessionId: string };

  const listRes = await request.get("/api/sessions");
  expect(listRes.status()).toBe(200);
  const { sessions } = (await listRes.json()) as {
    sessions: Array<{ id: string }>;
  };
  const found = sessions.some((s) => s.id === sessionId);
  expect(found).toBe(true);
});

test("Pro API does not return 403 for authenticated Pro user", async ({
  request,
}) => {
  const res = await request.get("/api/sessions");
  expect(res.status()).not.toBe(403);
});

test("consultations page loads and list resolves for Pro user", async ({
  page,
}) => {
  await page.goto(`/${LOCALE}/consultations`);

  const listLoader = page.getByRole("status", {
    name: /Načítám konzultace|Loading consultations|Загрузка консультаций/i,
  });
  await expect(listLoader).toBeHidden({ timeout: 15_000 });

  await expect(page).not.toHaveTitle(/500|error/i);
});

test("settings page is accessible for Pro user", async ({ page }) => {
  await page.goto(`/${LOCALE}/settings`);
  await expect(page).not.toHaveURL(/login/);
  await expect(page).not.toHaveURL(/pricing/);
  expect(page.url()).toContain("/settings");
});

test("Pro user is not redirected to pricing from consultations page", async ({
  page,
}) => {
  await page.goto(`/${LOCALE}/consultations`);
  await expect(page).not.toHaveURL(/pricing/);
});
