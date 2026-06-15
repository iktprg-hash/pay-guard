import { test, expect } from "./fixtures/auth";
import {
  isBillingEnabledOnPricing,
  mockStripeBillingSuite,
  mockSubscriptionTier,
} from "./helpers/billing-mocks";
import {
  UI,
  openProRouteExpectGate,
  pollForNoUpgradeGate,
  pollForProUnlocked,
  pricingPath,
  proPageHeading,
  proPath,
  refreshSubscriptionTier,
  waitForToast,
} from "./helpers/test-utils";

test.describe.configure({ mode: "parallel" });

test.describe("Checkout flow", () => {
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
      await mockStripeBillingSuite(page, baseURL!);

      await test.step("Start mocked Stripe checkout from pricing", async () => {
        tier.setTier("free");
        await page.goto(pricingPath());

        const upgradeButton = page.getByRole("button", {
          name: /upgrade|přejít na pro|перейти na pro/i,
        });
        await expect(upgradeButton).toBeEnabled();

        await upgradeButton.click();
        await page.waitForURL(/checkout=success/, { timeout: 30_000 });
      });

      await test.step("Confirm checkout and activate Pro", async () => {
        tier.setTier("pro");

        await expect
          .poll(async () => page.url().includes("checkout=success"))
          .toBe(true);

        await waitForToast(page, UI.checkoutSuccess);

        await expect
          .poll(async () => {
            const toast = page
              .locator('[role="alert"], [role="status"]')
              .filter({ hasText: UI.checkoutSuccess })
              .first();
            return toast.isVisible().catch(() => false);
          })
          .toBe(true);
      });

      await test.step("Pricing shows Manage Subscription for Pro", async () => {
        await page.reload();
        await pollForProUnlocked(page);

        await expect.soft(
          page.getByRole("button", { name: UI.manageSubscription })
        ).toBeVisible();
        await expect.soft(page.getByText(UI.proActive)).toBeVisible();
      });

      await test.step("Pro dashboard is accessible without gate", async () => {
        await page.goto(proPath("dashboard"));

        await expect.soft(
          proPageHeading(page, /dashboard|přehled|дашборд/i)
        ).toBeVisible();

        await pollForNoUpgradeGate(page);
        await expect.soft(
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
      await mockStripeBillingSuite(page, baseURL!);
      await refreshSubscriptionTier(page);

      await test.step("Simulate Stripe cancel redirect", async () => {
        await page.goto(`${pricingPath()}?checkout=cancelled`);

        await expect
          .poll(async () => page.url().includes("checkout=cancelled"))
          .toBe(true);
      });

      await test.step("Shows cancelled toast and keeps Free plan", async () => {
        await waitForToast(page, UI.checkoutCancelled);
        await expect.soft(page.getByText(UI.proActive)).toHaveCount(0);

        await expect
          .poll(async () => {
            const manage = page.getByRole("button", {
              name: UI.manageSubscription,
            });
            return !(await manage.isVisible().catch(() => false));
          })
          .toBe(true);
      });

      await test.step("Pro area remains gated", async () => {
        await openProRouteExpectGate(page, "dashboard");
      });
    });
  });
});
