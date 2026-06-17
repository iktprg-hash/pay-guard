import { test, expect } from "@playwright/test";

const L = process.env.E2E_LOCALE ?? "cs";

test.describe("Checkout flow — page states & API validation", () => {
  test("pricing page renders without error", async ({ page }) => {
    await page.goto(`/${L}/pricing`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).not.toHaveURL(/error|500/);
  });

  test("?checkout=cancelled shows status region with link back to pricing", async ({
    page,
  }) => {
    await page.goto(`/${L}/pricing?checkout=cancelled`);
    await expect(page.getByRole("status")).toBeVisible();
    // The cancelled card has a Button → Link back to /{locale}/pricing
    await expect(page.locator(`a[href="/${L}/pricing"]`)).toBeVisible();
  });

  test("?checkout=success resolves to success card with settings link", async ({
    page,
  }) => {
    await page.goto(
      `/${L}/pricing?checkout=success&session_id=cs_test_e2e_mock_0001`
    );
    await expect(page.getByRole("status")).toBeVisible();
    // CheckoutStatusHandler always shows success after confirm attempt
    // (catches 503 when Stripe not configured, or 422 for invalid session)
    await expect(page.locator(`a[href="/${L}/settings"]`)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("POST /api/billing/confirm — empty body → 400 or 503", async ({
    request,
  }) => {
    const res = await request.post("/api/billing/confirm", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    // 503 if Stripe not configured; 400 if configured but schema fails
    expect([400, 503]).toContain(res.status());
  });

  test("POST /api/billing/confirm — non-cs_ sessionId → 400 or 503", async ({
    request,
  }) => {
    const res = await request.post("/api/billing/confirm", {
      data: { sessionId: "not_a_stripe_session_id" },
      headers: { "Content-Type": "application/json" },
    });
    expect([400, 503]).toContain(res.status());
  });

  test("POST /api/billing/confirm — valid cs_ format but Stripe unavailable → 422 or 503", async ({
    request,
  }) => {
    const res = await request.post("/api/billing/confirm", {
      data: { sessionId: "cs_test_e2e_000000000000000000000000" },
      headers: { "Content-Type": "application/json" },
    });
    // 503 Stripe not configured, 422 session not found/incomplete, never 200
    expect([422, 503]).toContain(res.status());
  });
});
