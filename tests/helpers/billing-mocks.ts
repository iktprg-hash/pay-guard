import type { Page } from "@playwright/test";
import { E2E_LOCALE } from "../fixtures/auth";
import { pricingPath, UI } from "./test-utils";

export type SubscriptionTierMock = "free" | "pro";

export interface TierMockController {
  setTier: (tier: SubscriptionTierMock) => void;
  getTier: () => SubscriptionTierMock;
}

/** Mutable /api/auth/tier mock for checkout and Pro gating flows. */
export function mockSubscriptionTier(page: Page): TierMockController {
  let tier: SubscriptionTierMock = "free";

  void page.route("**/api/auth/tier", async (route) => {
    const isPro = tier !== "free";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tier,
        pro: isPro,
        isProEnabled: isPro,
        expiresAt: isPro ? "2099-01-01T00:00:00.000Z" : null,
      }),
    });
  });

  return {
    setTier(next) {
      tier = next;
    },
    getTier() {
      return tier;
    },
  };
}

/** Mock Stripe Checkout redirect back to pricing success URL. */
export async function mockStripeCheckoutSuccess(
  page: Page,
  baseURL: string,
  sessionId = "cs_test_e2e_mock"
): Promise<string> {
  const successUrl = `${baseURL}${pricingPath()}?checkout=success&session_id=${sessionId}`;

  await page.route("**/api/billing/checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: successUrl }),
    });
  });

  return successUrl;
}

/** @deprecated Use {@link mockStripeCheckoutSuccess} */
export const mockStripeCheckoutRedirect = mockStripeCheckoutSuccess;

/** Mock Stripe cancel redirect (client navigates to cancel_url). */
export async function mockStripeCheckoutCancel(
  page: Page,
  baseURL: string
): Promise<string> {
  const cancelUrl = `${baseURL}${pricingPath()}?checkout=cancelled`;

  await page.route("**/api/billing/checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: cancelUrl }),
    });
  });

  return cancelUrl;
}

/** Mock successful checkout confirmation (fallback when webhook is delayed). */
export async function mockBillingConfirmSuccess(page: Page): Promise<void> {
  await page.route("**/api/billing/confirm", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pro: true }),
    });
  });
}

/** Returns true when pricing page exposes a live Upgrade CTA (Stripe configured). */
export async function isBillingEnabledOnPricing(page: Page): Promise<boolean> {
  await page.goto(pricingPath());
  const upgrade = page.getByRole("button", {
    name: /upgrade|přejít na pro|перейти на pro/i,
  });
  const loginToUpgrade = page.getByRole("link", { name: UI.loginToUpgrade });
  const manage = page.getByRole("button", {
    name: /manage subscription|spravovat|управлять/i,
  });

  if (await manage.isVisible().catch(() => false)) return false;
  if (await upgrade.isVisible().catch(() => false)) {
    return upgrade.isEnabled();
  }
  if (await loginToUpgrade.isVisible().catch(() => false)) return true;
  return false;
}
