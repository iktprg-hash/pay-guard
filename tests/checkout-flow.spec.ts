import { test, expect } from "./fixtures/auth";
import {
  isStripeConfiguredInEnv,
  mockStripeBillingSuite,
  mockSubscriptionTier,
} from "./helpers/billing-mocks";
import { E2E_LONG_TIMEOUT } from "./helpers/e2e-timeouts";
import {
  UI,
  openProRouteExpectGate,
  pollForManageSubscriptionHidden,
  pollForNoUpgradeGate,
  pollForProUnlocked,
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
          name: UI.startCheckout,
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

      await test.step("Confirm checkout and show success screen", async () => {
        await expect
          .poll(
            async () =>
              page.getByText(UI.checkoutSuccess).isVisible().catch(() => false),
            { timeout: E2E_LONG_TIMEOUT, intervals: [300, 500, 1000] }
          )
          .toBe(true);

        await expect.soft(
          page.getByRole("link", { name: UI.goToSettings })
        ).toBeVisible();
        await waitForTierSettled(page);
      });

      await test.step("Pricing shows Manage Subscription for Pro", async () => {
        await gotoExpectOk(page, pricingPath());
        await waitForTierSettled(page);
        await pollForProUnlocked(page, { timeout: E2E_LONG_TIMEOUT });

        await expect.soft(
          page.getByRole("button", { name: UI.manageSubscription })
        ).toBeVisible();
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

      await test.step("Shows cancelled screen and keeps Free plan", async () => {
        await expect
          .poll(
            async () =>
              page.getByText(UI.checkoutCancelled).isVisible().catch(() => false),
            { timeout: E2E_LONG_TIMEOUT, intervals: [300, 500, 1000] }
          )
          .toBe(true);
        await pollForManageSubscriptionHidden(page);
      });

      await test.step("Pro area remains gated", async () => {
        await openProRouteExpectGate(page, "dashboard");
      });
    });
  });
});
