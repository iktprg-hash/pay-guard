import { expect, type Page } from "@playwright/test";
import { pricingPath, UI } from "./test-utils";
import { gotoExpectOk } from "./server-health";

export type SubscriptionTierMock = "free" | "pro";

export interface TierMockController {
  setTier: (tier: SubscriptionTierMock) => void;
  getTier: () => SubscriptionTierMock;
}

/** Mirrors server isStripeBillingConfigured — uses .env.local loaded in playwright.config. */
export function isStripeConfiguredInEnv(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const priceId = process.env.STRIPE_PRO_PRICE_ID?.trim() ?? "";
  if (!key || key.includes("sk_test_xxx") || key.includes("sk_live_xxx")) {
    return false;
  }
  if (
    !priceId ||
    priceId.includes("price_xxx") ||
    priceId.startsWith("prod_") ||
    !priceId.startsWith("price_")
  ) {
    return false;
  }
  return true;
}

const TIER_BODY = (tier: SubscriptionTierMock) => {
  const isPro = tier !== "free";
  return {
    tier,
    pro: isPro,
    isProEnabled: isPro,
    expiresAt: isPro ? "2099-01-01T00:00:00.000Z" : null,
  };
};

/** Mutable /api/auth/tier mock for checkout and Pro gating flows. */
export function mockSubscriptionTier(page: Page): TierMockController {
  let tier: SubscriptionTierMock = "free";

  void page.route("**/api/auth/tier", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TIER_BODY(tier)),
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

function billingUrls(baseURL: string, sessionId: string) {
  return {
    successUrl: `${baseURL}${pricingPath()}?checkout=success&session_id=${sessionId}`,
    cancelUrl: `${baseURL}${pricingPath()}?checkout=cancelled`,
  };
}

/** Mock Stripe Checkout redirect back to pricing success URL. */
export async function mockStripeCheckoutSuccess(
  page: Page,
  baseURL: string,
  sessionId = "cs_test_e2e_mock"
): Promise<string> {
  const { successUrl } = billingUrls(baseURL, sessionId);

  await page.route("**/api/billing/checkout", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
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
  const { cancelUrl } = billingUrls(baseURL, "unused");

  await page.route("**/api/billing/checkout", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
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
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pro: true, tier: "pro" }),
    });
  });
}

/** Mock billing sync endpoint (used when session_id is absent). */
export async function mockBillingSyncSuccess(page: Page): Promise<void> {
  await page.route("**/api/billing/sync", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pro: true, tier: "pro" }),
    });
  });
}

/**
 * Full Stripe billing mock — success flow (checkout + confirm + sync).
 * Pair with {@link mockStripeCheckoutCancel} for cancel scenarios.
 */
export async function mockStripeBillingFlow(
  page: Page,
  baseURL: string,
  sessionId = "cs_test_e2e_mock"
): Promise<{ successUrl: string; cancelUrl: string }> {
  const urls = billingUrls(baseURL, sessionId);
  await mockStripeCheckoutSuccess(page, baseURL, sessionId);
  await mockBillingConfirmSuccess(page);
  await mockBillingSyncSuccess(page);
  return urls;
}

/** Register success + confirm + sync mocks. Cancel flow uses direct redirect URL in tests. */
export async function mockStripeBillingSuite(
  page: Page,
  baseURL: string,
  sessionId = "cs_test_e2e_mock"
): Promise<{ successUrl: string; cancelUrl: string }> {
  return mockStripeBillingFlow(page, baseURL, sessionId);
}

/** Returns true when pricing page exposes a live Upgrade CTA (Stripe configured). */
export async function isBillingEnabledOnPricing(page: Page): Promise<boolean> {
  await gotoExpectOk(page, pricingPath());

  const upgrade = page.getByRole("button", { name: UI.startCheckout });
  const loginToUpgrade = page.getByRole("link", { name: UI.loginToUpgrade });
  const manage = page.getByRole("button", {
    name: /manage subscription|spravovat|управлять/i,
  });

  await expect
    .poll(
      async () => {
        if (
          await page
            .getByText(/^internal server error$/i)
            .isVisible()
            .catch(() => false)
        ) {
          return "error";
        }
        if (await manage.isVisible().catch(() => false)) return "pro";
        if (await loginToUpgrade.isVisible().catch(() => false)) return "login";
        if (await upgrade.isVisible().catch(() => false)) {
          return (await upgrade.isEnabled()) ? "upgrade" : "disabled";
        }
        return "loading";
      },
      { timeout: 20_000, intervals: [250, 500, 1000] }
    )
    .not.toBe("loading")
    .then(() => "ok")
    .catch(() => {
      throw new Error(
        `Pricing actions never settled at ${page.url()}. npm run dev:restart`
      );
    });

  if (await manage.isVisible().catch(() => false)) return false;
  if (await upgrade.isVisible().catch(() => false)) {
    return upgrade.isEnabled();
  }
  if (await loginToUpgrade.isVisible().catch(() => false)) return true;
  return false;
}
