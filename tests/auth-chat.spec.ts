import { test, expect } from "@playwright/test";
import { E2E_LOCALE } from "./fixtures/auth";
import { pricingGuestUpgradeLink } from "./helpers/test-utils";
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
    await gotoExpectOk(page, `/${E2E_LOCALE}/pricing`);

    const loginLink = pricingGuestUpgradeLink(page);
    const upgradeButton = page.getByRole("button", {
      name: /upgrade|přejít na pro|перейти на pro/i,
    });

    await expect
      .poll(
        async () => {
          if (await loginLink.isVisible().catch(() => false)) return "login";
          if (await upgradeButton.isVisible().catch(() => false)) {
            return (await upgradeButton.isEnabled()) ? "upgrade" : "disabled";
          }
          return "loading";
        },
        { timeout: 20_000 }
      )
      .not.toBe("loading");

    test.skip(
      !(await loginLink.isVisible().catch(() => false)),
      "Guest login CTA is only shown when Stripe billing is enabled."
    );

    await loginLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/${E2E_LOCALE}/login\\?next=`),
      { timeout: 20_000 }
    );
  });
});
