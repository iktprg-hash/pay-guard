import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_LOCALE } from "../fixtures/auth";
import { gotoExpectOk } from "./server-health";
import {
  E2E_LONG_TIMEOUT,
  E2E_POLL_TIMEOUT,
  E2E_TIER_TIMEOUT,
  E2E_TOAST_TIMEOUT,
} from "./e2e-timeouts";

/** Default backoff for UI state polls (TanStack Query / Stripe redirects). */
export const POLL_INTERVALS = [300, 500, 750, 1000, 1500] as const;

/** Locale-aware regex helpers for next-intl UI copy. */
export const UI = {
  upgradeBanner:
    /upgrade to pay guard pro|upgradujte na pay guard pro|přejít na pay guard pro|перейдите на pay guard pro/i,
  upgradeCta: /upgrade to pro|přejít na pro|перейти на pro/i,
  proOverlay: /^pro$/i,
  proActive: /pro is active|pro je aktivní|pro aktivováno|pro активен/i,
  manageSubscription:
    /manage subscription|spravovat předplatné|управлять подпиской/i,
  startCheckout:
    /get pro|začít s pro|перейти на pro|sign in to purchase|přihlásit se pro nákup|войдите для покупки/i,
  checkoutSuccess:
    /welcome to pro|vítejte v pro|добро пожаловать в pro/i,
  checkoutActivating:
    /processing your payment|zpracováváme platbu|обрабатываем платёж/i,
  checkoutCancelled:
    /payment cancelled|platba zrušena|платёж отменён/i,
  goToSettings:
    /go to settings|přejít do nastavení|перейти в настройки/i,
  loginToUpgrade:
    /sign in to purchase|přihlásit se pro nákup|войдите для покупки/i,
  pdfProUpsell: /pdf — pro|pdf.*pro/i,
  recommendationTitle: /recommendation|doporučení|рекомендация/i,
  lockedHint:
    /pro features are preview-only|pro funkce jsou|náhled|только предпросмотр/i,
} as const;

export function pricingPath(locale = E2E_LOCALE): string {
  return `/${locale}/pricing`;
}

export function proPath(segment: string, locale = E2E_LOCALE): string {
  return `/${locale}/pro/${segment}`;
}

/** Pro route page title (h1) — avoids empty-state h3 headings that share keywords. */
export function proPageHeading(page: Page, name: RegExp): Locator {
  return page.getByRole("heading", { level: 1, name });
}

/** Guest pricing CTA — waits until auth/tier loading finishes. */
export function pricingGuestUpgradeLink(page: Page): Locator {
  return page.getByRole("link", { name: UI.loginToUpgrade });
}

/** Latest recommendation card (manual/chat may render multiple cards). */
export function latestRecommendationHeading(page: Page): Locator {
  return page.getByRole("heading", { name: UI.recommendationTitle }).last();
}

/** PDF upsell link on the latest recommendation card. */
export function latestPdfProUpsellLink(page: Page): Locator {
  return page.getByRole("link", { name: UI.pdfProUpsell }).last();
}

/** Bust TanStack Query tier cache after changing route mocks in serial suites. */
export async function refreshSubscriptionTier(page: Page): Promise<void> {
  const tierResponse = page.waitForResponse(
    (res) => res.url().includes("/api/auth/tier") && res.ok(),
    { timeout: E2E_TIER_TIMEOUT }
  );
  try {
    await gotoExpectOk(page, pricingPath());
  } finally {
    await tierResponse.catch(() => undefined);
  }
  await waitForTierSettled(page);
}

/** Wait until /api/auth/tier fetch and Pro gate loading skeleton settle. */
export async function waitForTierSettled(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? E2E_TIER_TIMEOUT;

  await page
    .waitForResponse(
      (res) => res.url().includes("/api/auth/tier") && res.ok(),
      { timeout }
    )
    .catch(() => undefined);

  await expect
    .poll(
      async () => {
        const busyCount = await page
          .locator('[role="status"][aria-busy="true"]')
          .count()
          .catch(() => -1);
        const gateLoading = await page
          .getByText(/loading pro|načítám pro|загрузка pro/i)
          .isVisible()
          .catch(() => false);
        return busyCount === 0 && !gateLoading;
      },
      {
        timeout,
        intervals: [...POLL_INTERVALS],
      }
    )
    .toBe(true);
}

/** Wait until pricing Upgrade CTA is interactive (tier/auth loading finished). */
export async function waitForPricingUpgradeReady(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? E2E_POLL_TIMEOUT;
  const upgrade = page.getByRole("button", { name: UI.startCheckout });

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
        if (await upgrade.isVisible().catch(() => false)) {
          return (await upgrade.isEnabled()) ? "ready" : "disabled";
        }
        return "loading";
      },
      { timeout, intervals: [...POLL_INTERVALS] }
    )
    .toBe("ready");
}

/** Poll checkout redirect + billing confirm (Stripe mock flow). */
export async function pollForCheckoutSuccess(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? E2E_LONG_TIMEOUT;

  await expect
    .poll(async () => page.url().includes("checkout=success"), {
      timeout,
      intervals: [...POLL_INTERVALS],
    })
    .toBe(true);

  await waitForBillingConfirm(page, { timeout });
}

/** Track billing confirm/sync responses (attach before checkout click). */
export function watchBillingConfirm(
  page: Page,
  options: { timeout?: number } = {}
): { done: Promise<void> } {
  const timeout = options.timeout ?? E2E_LONG_TIMEOUT;
  const matchesBilling = (url: string) =>
    url.includes("/api/billing/confirm") || url.includes("/api/billing/sync");

  let seen = false;
  const onResponse = (res: { url: () => string; ok: () => boolean }) => {
    if (matchesBilling(res.url()) && res.ok()) seen = true;
  };
  page.on("response", onResponse);

  const done = expect
    .poll(async () => seen, {
      timeout,
      intervals: [...POLL_INTERVALS],
    })
    .toBe(true)
    .finally(() => {
      page.off("response", onResponse);
    });

  return { done };
}

/** Wait for checkout confirm/sync after Stripe redirect. */
export async function waitForBillingConfirm(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  await watchBillingConfirm(page, options).done;
}

/** Wait for toast/alert copy (next-intl toasts use role=alert or role=status). */
export async function waitForToast(
  page: Page,
  pattern: RegExp,
  timeout = E2E_TOAST_TIMEOUT
): Promise<Locator> {
  const toast = page
    .locator('[role="alert"], [role="status"]')
    .filter({ hasText: pattern })
    .first();

  await expect(toast).toBeVisible({ timeout });
  return toast;
}

/** Fill the manual prioritization form and submit. */
export async function fillFinancialForm(
  page: Page,
  options: {
    funds?: string;
    creditor?: string;
    amount?: string;
    dueDate?: string;
  } = {}
): Promise<void> {
  const {
    funds = "15000",
    creditor = "Test Utility Co",
    amount = "4500",
    dueDate = "2026-12-31",
  } = options;

  await expect(page.locator("#funds")).toBeVisible({ timeout: E2E_POLL_TIMEOUT });
  await page.locator("#funds").fill(funds);
  await page
    .getByLabel(/creditor|věřitel|кредитор/i)
    .first()
    .fill(creditor);
  await page.getByLabel(/amount|částka|сумма/i).first().fill(amount);
  await page
    .getByLabel(/due date|splatnost|срок/i)
    .first()
    .fill(dueDate);
  await page
    .getByRole("button", {
      name: /calculate priorities|vypočítat priority|рассчитать приоритет/i,
    })
    .click();
}

/** Wait until RecommendationCard heading is visible. */
export async function waitForRecommendation(page: Page): Promise<void> {
  await expect(latestRecommendationHeading(page)).toBeVisible({
    timeout: E2E_POLL_TIMEOUT,
  });
}

/**
 * Inner ProUpgradeBanner card (nth(0) is the outer ProFeatureGate wrapper).
 */
export function proUpgradeBanner(page: Page): Locator {
  return page.getByRole("region", { name: UI.upgradeBanner }).nth(1);
}

/** Upgrade CTA inside the top banner only (not the overlay). */
export function proBannerUpgradeLink(page: Page): Locator {
  return proUpgradeBanner(page).getByRole("link", { name: UI.upgradeCta });
}

/** ProFeatureGate locked overlay region. */
export function proLockedOverlay(page: Page): Locator {
  return page.getByRole("region", { name: UI.proOverlay });
}

/** Upgrade CTA inside the locked overlay. */
export function proOverlayUpgradeLink(page: Page): Locator {
  return proLockedOverlay(page).getByRole("link", { name: UI.upgradeCta });
}

/** Wait until tier gate finishes loading and the upgrade banner appears. */
export async function waitForProGate(page: Page): Promise<void> {
  await expect(
    page.getByRole("region", { name: UI.upgradeBanner }).first()
  ).toBeVisible({ timeout: E2E_POLL_TIMEOUT });
}

/** Open a Pro route and wait until tier gate is gone and page heading is visible. */
export async function openProRouteExpectUnlocked(
  page: Page,
  segment: string,
  heading: RegExp,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? E2E_LONG_TIMEOUT;

  await gotoExpectOk(page, proPath(segment));
  await waitForTierSettled(page, { timeout });
  await pollForNoUpgradeGate(page, { timeout });
  await pollUntilVisible(proPageHeading(page, heading), { timeout });
}

/** Open a Pro route and wait for the Free-tier upgrade gate. */
export async function openProRouteExpectGate(
  page: Page,
  segment: string
): Promise<void> {
  await gotoExpectOk(page, proPath(segment));
  await waitForTierSettled(page);
  await waitForProGate(page);
}

/** Poll until the current URL contains a query fragment. */
export async function pollForUrlContains(
  page: Page,
  fragment: string,
  options: { timeout?: number } = {}
): Promise<void> {
  await expect
    .poll(async () => page.url().includes(fragment), {
      timeout: options.timeout ?? E2E_LONG_TIMEOUT,
      intervals: [...POLL_INTERVALS],
    })
    .toBe(true);
}

/** Poll until a toast/alert with matching copy is visible. */
export async function pollForToastVisible(
  page: Page,
  pattern: RegExp,
  options: { timeout?: number } = {}
): Promise<void> {
  const toast = page
    .locator('[role="alert"], [role="status"]')
    .filter({ hasText: pattern })
    .first();

  await expect
    .poll(async () => toast.isVisible().catch(() => false), {
      timeout: options.timeout ?? E2E_POLL_TIMEOUT,
      intervals: [...POLL_INTERVALS],
    })
    .toBe(true);
}

/** Poll until Manage Subscription CTA is not shown (Free tier). */
export async function pollForManageSubscriptionHidden(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const manage = page.getByRole("button", { name: UI.manageSubscription });

  await expect
    .poll(async () => !(await manage.isVisible().catch(() => false)), {
      timeout: options.timeout ?? E2E_POLL_TIMEOUT,
      intervals: [...POLL_INTERVALS],
    })
    .toBe(true);
}

/** Poll until Pro gate is visible (Free tier). */
export async function pollForProGated(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  await expect
    .poll(
      async () =>
        page
          .getByRole("region", { name: UI.upgradeBanner })
          .first()
          .isVisible()
          .catch(() => false),
      {
        timeout: options.timeout ?? E2E_LONG_TIMEOUT,
        intervals: [...POLL_INTERVALS],
      }
    )
    .toBe(true);
}

/** Poll until Pro UI is unlocked (Manage subscription / no upgrade gate). */
export async function pollForProUnlocked(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  await expect
    .poll(
      async () => {
        const manageVisible = await page
          .getByRole("button", { name: UI.manageSubscription })
          .isVisible()
          .catch(() => false);
        const proActiveVisible = await page
          .getByText(UI.proActive)
          .isVisible()
          .catch(() => false);
        const gateCount = await page
          .getByRole("region", { name: UI.upgradeBanner })
          .count()
          .catch(() => -1);
        return (manageVisible || proActiveVisible) && gateCount === 0;
      },
      {
        timeout: options.timeout ?? E2E_LONG_TIMEOUT,
        intervals: [...POLL_INTERVALS],
      }
    )
    .toBe(true);
}

/** Poll until upgrade gate count is zero on current page. */
export async function pollForNoUpgradeGate(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  await expect
    .poll(
      async () =>
        page
          .getByRole("region", { name: UI.upgradeBanner })
          .count()
          .catch(() => -1),
      {
        timeout: options.timeout ?? E2E_LONG_TIMEOUT,
        intervals: [...POLL_INTERVALS],
      }
    )
    .toBe(0);
}

/** Poll until ProFeatureGate locked overlay disappears. */
export async function pollForOverlayHidden(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  await expect
    .poll(
      async () => (await proLockedOverlay(page).count()) === 0,
      {
        timeout: options.timeout ?? E2E_LONG_TIMEOUT,
        intervals: [...POLL_INTERVALS],
      }
    )
    .toBe(true);
}

/** Poll until both upgrade gate and locked overlay are gone (Pro unlocked). */
export async function pollForGateFullyUnlocked(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? E2E_LONG_TIMEOUT;

  await expect
    .poll(
      async () => {
        const loading =
          (await page.locator('[role="status"][aria-busy="true"]').count()) >
          0;
        if (loading) return false;

        const gateCount = await page
          .getByRole("region", { name: UI.upgradeBanner })
          .count()
          .catch(() => -1);
        const overlayCount = await proLockedOverlay(page)
          .count()
          .catch(() => -1);

        return gateCount === 0 && overlayCount === 0;
      },
      {
        timeout,
        intervals: [...POLL_INTERVALS],
      }
    )
    .toBe(true);
}

/** Blurred preview wrapper inside ProFeatureGate. */
export function proBlurredPreview(page: Page): Locator {
  return page.locator("[aria-hidden='true'].blur-sm");
}

/** Assert ProFeatureGate blur overlay + locked overlay are present. */
export async function expectProGateWithBlur(page: Page): Promise<void> {
  await expect.soft(proUpgradeBanner(page)).toBeVisible();
  await expect.soft(proLockedOverlay(page)).toBeVisible();
  await expect.soft(proBlurredPreview(page).first()).toBeVisible();
  await expect.soft(page.getByText(UI.lockedHint)).toBeVisible();
}

/** Poll until a locator becomes visible (subscription/UI state changes). */
export async function pollUntilVisible(
  locator: Locator,
  options: { timeout?: number; intervals?: number[] } = {}
): Promise<void> {
  await expect
    .poll(async () => locator.isVisible().catch(() => false), {
      timeout: options.timeout ?? E2E_POLL_TIMEOUT,
      intervals: options.intervals ?? [...POLL_INTERVALS],
    })
    .toBe(true);
}

/** Poll until a locator is hidden or detached. */
export async function pollUntilHidden(
  locator: Locator,
  options: { timeout?: number } = {}
): Promise<void> {
  await expect
    .poll(async () => locator.isVisible().catch(() => false), {
      timeout: options.timeout ?? E2E_POLL_TIMEOUT,
      intervals: [...POLL_INTERVALS],
    })
    .toBe(false);
}
