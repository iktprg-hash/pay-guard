import { test as guestTest, expect } from "@playwright/test";
import { E2E_LOCALE, test } from "./fixtures/auth";
import {
  isBillingEnabledOnPricing,
  mockBillingConfirmSuccess,
  mockStripeCheckoutCancel,
  mockStripeCheckoutSuccess,
  mockSubscriptionTier,
} from "./helpers/billing-mocks";
import {
  UI,
  pollUntilHidden,
  pollUntilVisible,
  pricingPath,
  proPath,
  waitForToast,
} from "./helpers/test-utils";

test.describe.configure({ mode: "parallel" });

test.describe("Checkout flow", () => {
  guestTest.describe("unauthenticated", () => {
    guestTest.use({ storageState: { cookies: [], origins: [] } });

    guestTest(
      "redirects to login when guest clicks upgrade on pricing",
      async ({ page }) => {
        await guestTest.step("Open pricing as guest", async () => {
          await page.goto(pricingPath());
        });

        await guestTest.step(
          "Upgrade CTA sends user to login with return URL",
          async () => {
            const loginLink = page.getByRole("link", {
              name: /sign in to upgrade|přihlásit se a přejít|войти.*pro/i,
            });
            await expect.soft(loginLink).toBeVisible();
            await loginLink.click();
            await expect(page).toHaveURL(
              new RegExp(`/${E2E_LOCALE}/login\\?next=`)
            );
          }
        );
      }
    );
  });

  test.describe("authenticated free user", () => {
    test.describe.configure({ mode: "serial" });

    test("completes mocked checkout and unlocks Pro UI", async ({
      page,
      baseURL,
    }) => {
      test.slow();
      test.skip(!baseURL, "baseURL is required");

      const billingEnabled = await isBillingEnabledOnPricing(page);
      test.skip(
        !billingEnabled,
        "Stripe billing is not configured — set STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID."
      );

      const tier = mockSubscriptionTier(page);
      await mockBillingConfirmSuccess(page);

      await test.step("Start mocked Stripe checkout from pricing", async () => {
        tier.setTier("free");
        await page.goto(pricingPath());
        await mockStripeCheckoutSuccess(page, baseURL!);

        const upgradeButton = page.getByRole("button", {
          name: /upgrade|přejít na pro|перейти на pro/i,
        });
        await expect(upgradeButton).toBeEnabled();

        await upgradeButton.click();
        await page.waitForURL(/checkout=success/, { timeout: 30_000 });
      });

      await test.step("Confirm checkout and activate Pro", async () => {
        tier.setTier("pro");
        await waitForToast(page, UI.checkoutSuccess);
      });

      await test.step("Pricing shows Manage Subscription for Pro", async () => {
        await page.reload();

        await pollUntilVisible(
          page.getByRole("button", { name: UI.manageSubscription })
        );

        await expect.soft(
          page.getByRole("button", { name: UI.manageSubscription })
        ).toBeVisible();
        await expect.soft(page.getByText(UI.proActive)).toBeVisible();
      });

      await test.step("Pro dashboard is accessible without gate", async () => {
        await page.goto(proPath("dashboard"));

        await expect.soft(
          page.getByRole("heading", { name: /dashboard|přehled|дашборд/i })
        ).toBeVisible();

        await pollUntilHidden(
          page.getByRole("region", { name: UI.upgradeBanner })
        );

        await expect(
          page.getByRole("region", { name: UI.upgradeBanner })
        ).toHaveCount(0);
      });
    });

    test("returns to pricing without Pro after cancelled checkout", async ({
      page,
      baseURL,
    }) => {
      test.slow();
      test.skip(!baseURL, "baseURL is required");

      const tier = mockSubscriptionTier(page);
      tier.setTier("free");

      await test.step("Simulate Stripe cancel redirect", async () => {
        await page.goto(`${pricingPath()}?checkout=cancelled`);
      });

      await test.step("Shows cancelled toast and keeps Free plan", async () => {
        await waitForToast(page, UI.checkoutCancelled);
        await expect.soft(page.getByText(UI.proActive)).toHaveCount(0);
      });

      await test.step("Mock checkout cancel URL when user retries upgrade", async () => {
        await mockStripeCheckoutCancel(page, baseURL!);
        await page.goto(pricingPath());

        const upgradeButton = page.getByRole("button", {
          name: /upgrade|přejít na pro|перейти на pro/i,
        });

        if (await upgradeButton.isVisible().catch(() => false)) {
          await upgradeButton.click();
          await page.waitForURL(/checkout=cancelled/, { timeout: 30_000 });
          await waitForToast(page, UI.checkoutCancelled);
        }
      });

      await test.step("Pro area remains gated", async () => {
        await page.goto(proPath("dashboard"));
        await expect(
          page.getByRole("region", { name: UI.upgradeBanner })
        ).toBeVisible();
      });
    });
  });
});
