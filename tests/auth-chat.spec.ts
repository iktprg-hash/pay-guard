import { test, expect } from "@playwright/test";
import { E2E_LOCALE } from "./fixtures/auth";
import {
  pricingGuestCheckoutButton,
  UI,
  waitForTierSettled,
} from "./helpers/test-utils";
import { gotoExpectOk, expectApiOk } from "./helpers/server-health";

test.describe.configure({ mode: "parallel" });

test.describe("Auth and chat flow", () => {
  test("redirects unauthenticated users from chat to login", async ({ page }) => {
    const response = await page.goto(`/${E2E_LOCALE}`, {
      waitUntil: "domcontentloaded",
    });
    if (response && !response.ok()) {
      throw new Error(
        `GET /${E2E_LOCALE} returned HTTP ${response.status()}. npm run dev:restart`
      );
    }
    await expect(page.getByText(/^internal server error$/i)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/${E2E_LOCALE}/login`), {
      timeout: 20_000,
    });
  });

  test("login page offers navigation to register", async ({ page }) => {
    await gotoExpectOk(page, `/${E2E_LOCALE}/login`);
    await expect(
      page.getByRole("heading", { name: /Přihlášení|Login|Вход/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Registrace|Register|Регистрация/i })
    ).toBeVisible();
  });

  test("register page offers navigation to login", async ({ page }) => {
    await gotoExpectOk(page, `/${E2E_LOCALE}/register`);
    await expect(
      page.getByRole("heading", { name: /Registrace|Register|Регистрация/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Přihlášení|Login|Вход/i })
    ).toBeVisible();
  });

  test("chat API returns 401 without authenticated session", async ({
    request,
  }) => {
    const res = await request.post("/api/chat", {
      data: {
        messages: [{ role: "user", content: "Ahoj" }],
        profile: { availableFunds: 5000, debts: [] },
        locale: "cs",
      },
    });

    expect(res.status()).toBe(401);
  });

  test("grok consent API returns 401 without authenticated session", async ({
    request,
  }) => {
    const res = await request.get("/api/auth/grok-consent");
    expect(res.status()).toBe(401);
  });

  test("prioritize API returns 401 without authenticated session", async ({
    request,
  }) => {
    const res = await request.post("/api/prioritize", {
      data: {
        profile: {
          availableFunds: 10_000,
          debts: [
            {
              id: "d1",
              creditor: "ČEZ",
              amount: 3000,
              category: "utilities",
              dueDate: "2026-06-20",
            },
          ],
        },
        locale: "cs",
      },
    });

    expect(res.status()).toBe(401);
  });

  test("redirects guest from pricing upgrade CTA to login", async ({ page }) => {
    test.slow();
    test.setTimeout(45_000);

    await gotoExpectOk(page, `/${E2E_LOCALE}/pricing`);
    await waitForTierSettled(page);

    const guestCheckoutButton = pricingGuestCheckoutButton(page);

    const guestCtaVisible = await guestCheckoutButton
      .isVisible({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !guestCtaVisible,
      "Guest checkout CTA is only shown when Stripe billing is enabled."
    );

    await expect
      .poll(
        async () => (await guestCheckoutButton.textContent())?.trim() ?? "",
        { timeout: 30_000, intervals: [500, 1000] }
      )
      .toMatch(UI.loginToUpgrade);

    await guestCheckoutButton.click();

    await expect(page).toHaveURL(
      new RegExp(`/${E2E_LOCALE}/login\\?next=`),
      { timeout: 20_000 }
    );
  });
});
