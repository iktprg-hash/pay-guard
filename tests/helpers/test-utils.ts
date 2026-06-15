import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_LOCALE } from "../fixtures/auth";

/** Locale-aware regex helpers for next-intl UI copy. */
export const UI = {
  upgradeBanner:
    /upgrade to pay guard pro|upgradujte na pay guard pro|přejít na pay guard pro|перейдите на pay guard pro/i,
  upgradeCta: /upgrade to pro|přejít na pro|перейти на pro/i,
  proOverlay: /^pro$/i,
  proActive: /pro is active|pro je aktivní|pro tarif|pro активен/i,
  manageSubscription:
    /manage subscription|spravovat předplatné|управлять подпиской/i,
  checkoutSuccess: /thank you|děkujeme|спасибо/i,
  checkoutCancelled:
    /checkout was cancelled|platba byla zrušena|оплата отменена/i,
  loginToUpgrade:
    /sign in to upgrade to pro|přihlásit se a přejít na pro|войти и перейти на pro/i,
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
  await page.goto(pricingPath());
  await page.reload();
}

/** Wait for toast/alert copy (next-intl toasts use role=alert or role=status). */
export async function waitForToast(
  page: Page,
  pattern: RegExp,
  timeout = 15_000
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

  await expect(page.locator("#funds")).toBeVisible({ timeout: 20_000 });
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
    timeout: 20_000,
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
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByRole("region", { name: UI.upgradeBanner }).first()
  ).toBeVisible({ timeout: 20_000 });
}

/** Poll until a locator becomes visible (subscription/UI state changes). */
export async function pollUntilVisible(
  locator: Locator,
  options: { timeout?: number; intervals?: number[] } = {}
): Promise<void> {
  await expect
    .poll(async () => locator.isVisible().catch(() => false), {
      timeout: options.timeout ?? 15_000,
      intervals: options.intervals ?? [250, 500, 1000],
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
      timeout: options.timeout ?? 15_000,
      intervals: [250, 500, 1000],
    })
    .toBe(false);
}
