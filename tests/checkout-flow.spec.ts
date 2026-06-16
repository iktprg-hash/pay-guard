import { test, expect } from "./fixtures/auth";
import {
  isStripeConfiguredInEnv,
  mockStripeBillingSuite,
  mockSubscriptionTier,
} from "./helpers/billing-mocks";
import { E2E_LONG_TIMEOUT, E2E_TOAST_TIMEOUT } from "./helpers/e2e-timeouts";
import {
  UI,
  openProRouteExpectGate,
  pollForManageSubscriptionHidden,
  pollForNoUpgradeGate,
  pollForProUnlocked,
  pollForToastVisible,
  pollForUrlContains,
  pricingPath,
  proPageHeading,
  proPath,
  refreshSubscriptionTier,
  waitForPricingUpgradeReady,
  waitForTierSettled,
  watchBillingConfirm,
} from "./helpers/test-utils";
import { gotoExpectOk } from "./helpers/server-health";

test.describe.configure({ mode: "parallel" });

test.describe("Checkout flow", () => {
  test.describe("authenticated free user", () => {
    test.describe.configure({ mode: "serial" });
    test.slow();

    test("completes mocked checkout and unlocks Pro UI", async ({
      page,
      baseURL,
    }) => {
      test.skip(!baseURL, "baseURL is required");

      test.skip(
        !isStripeConfiguredInEnv(),
        "Stripe billing is not configured — set STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID in .env.local."
      );

      const tier = mockSubscriptionTier(page);
      tier.setTier("free");
      await mockStripeBillingSuite(page, baseURL!);
      await refreshSubscriptionTier(page);

      await test.step("Start mocked Stripe checkout from pricing", async () => {
        tier.setTier("free");
        await gotoExpectOk(page, pricingPath());
        await waitForPricingUpgradeReady(page);

        const upgradeButton = page.getByRole("button", {
          name: /upgrade|přejít na pro|перейти на pro/i,
        });
        await expect.soft(upgradeButton).toBeVisible();
        await expect.soft(upgradeButton).toBeEnabled();

        const billing = watchBillingConfirm(page, { timeout: E2E_LONG_TIMEOUT });
        await upgradeButton.click();
        tier.setTier("pro");

        await pollForUrlContains(page, "checkout=success", {
          timeout: E2E_LONG_TIMEOUT,
        });
        await billing.done;
      });

      await test.step("Confirm checkout and activate Pro", async () => {
        await pollForToastVisible(page, UI.checkoutSuccess, {
          timeout: E2E_TOAST_TIMEOUT,
        });
        await expect.soft(page.getByText(UI.checkoutSuccess)).toBeVisible();
        await waitForTierSettled(page);
      });

      await test.step("Pricing shows Manage Subscription for Pro", async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForTierSettled(page);
        await pollForProUnlocked(page, { timeout: E2E_LONG_TIMEOUT });

        await expect.soft(
          page.getByRole("button", { name: UI.manageSubscription })
        ).toBeVisible();
        await expect.soft(page.getByText(UI.proActive)).toBeVisible();
      });

      await test.step("Pro dashboard is accessible without gate", async () => {
        await gotoExpectOk(page, proPath("dashboard"));

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
      test.skip(!baseURL, "baseURL is required");

      const tier = mockSubscriptionTier(page);
      tier.setTier("free");
      await mockStripeBillingSuite(page, baseURL!);
      await refreshSubscriptionTier(page);

      await test.step("Simulate Stripe cancel redirect", async () => {
        await gotoExpectOk(page, `${pricingPath()}?checkout=cancelled`);
        await pollForUrlContains(page, "checkout=cancelled", {
          timeout: E2E_LONG_TIMEOUT,
        });
      });

      await test.step("Shows cancelled toast and keeps Free plan", async () => {
        await pollForToastVisible(page, UI.checkoutCancelled, {
          timeout: E2E_TOAST_TIMEOUT,
        });
        await expect.soft(page.getByText(UI.proActive)).toHaveCount(0);
        await pollForManageSubscriptionHidden(page);
      });

      await test.step("Pro area remains gated", async () => {
        await openProRouteExpectGate(page, "dashboard");
      });
    });
  });
});
