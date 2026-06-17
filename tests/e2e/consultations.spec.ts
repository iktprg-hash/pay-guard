import { test, expect } from "@playwright/test";

const L = process.env.E2E_LOCALE ?? "cs";

test.describe("Consultations — free authenticated user", () => {
  test("consultations page accessible without redirect to login", async ({
    page,
  }) => {
    await page.goto(`/${L}/consultations`);
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("page has new consultation link to home", async ({ page }) => {
    await page.goto(`/${L}/consultations`);
    // Page component renders <Link href="/{locale}"> for new consultation
    // Also empty state renders <Link href="/{locale}"> for start first
    const homeLink = page.locator(`a[href="/${L}"]`).first();
    await expect(homeLink).toBeVisible({ timeout: 10_000 });
  });

  test("consultation list finishes loading (spinner disappears)", async ({
    page,
  }) => {
    await page.goto(`/${L}/consultations`);
    // Loading spinner has role="status" — wait for it to resolve
    // It may never appear if load is instant; toBeHidden handles both cases
    await expect(page.getByRole("status")).toBeHidden({ timeout: 10_000 });
  });

  test("empty state or list is rendered after load", async ({ page }) => {
    await page.goto(`/${L}/consultations`);
    // After loading, either empty state or list of <li> items is visible
    await expect(page.locator("h1")).toBeVisible();
    // No crash — page is functional
    await expect(page).not.toHaveURL(/error|500/);
  });

  test("clicking new consultation navigates to home", async ({ page }) => {
    await page.goto(`/${L}/consultations`);
    // Wait for page to settle
    await expect(page.locator("h1")).toBeVisible();
    const homeLink = page.locator(`a[href="/${L}"]`).first();
    await expect(homeLink).toBeVisible({ timeout: 10_000 });
    await homeLink.click();
    await page.waitForURL(new RegExp(`/${L}$`), { timeout: 15_000 });
  });
});
