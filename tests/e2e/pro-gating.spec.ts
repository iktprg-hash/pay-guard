import {
  test,
  expect,
  ensureFreeSubscriptionTier,
  getTestUserCredentials,
} from "../fixtures/auth";

const L = process.env.E2E_LOCALE ?? "cs";

test.describe("Pro gating — free user cannot access Pro API routes", () => {
  test.beforeAll(async ({ request, baseURL }) => {
    if (!baseURL) return;
    await ensureFreeSubscriptionTier(request, getTestUserCredentials());
  });

  test.beforeEach(({ }, testInfo) => {
    if (testInfo.project.name === "mobile") {
      test.slow();
    }
  });

  test("GET /api/sessions → 403 for free user", async ({ request }) => {
    await expect
      .poll(async () => request.get("/api/sessions").then((res) => res.status()), {
        timeout: 10_000,
      })
      .toBe(403);
  });

  test("GET /api/sessions/[uuid] → 403 for free user", async ({ request }) => {
    const res = await request.get(
      "/api/sessions/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status()).toBe(403);
  });

  test("POST /api/sessions → 403 for free user", async ({ request }) => {
    const res = await request.post("/api/sessions", {
      data: { locale: "cs" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });

  test("GET /api/chat/history → 403 for free user", async ({ request }) => {
    const res = await request.get("/api/chat/history");
    expect(res.status()).toBe(403);
  });

  test("POST /api/chat/history → 403 for free user", async ({ request }) => {
    const res = await request.post("/api/chat/history", {
      data: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        messages: [],
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });

  test("settings page accessible to authenticated user", async ({ page }) => {
    await page.goto(`/${L}/settings`);
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  // This test also runs in the "mobile" Playwright project (Pixel 7 viewport)
  test("pricing page renders on current viewport", async ({ page }) => {
    await page.goto(`/${L}/pricing`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).not.toHaveURL(/error/);
  });
});
