import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_LOCALE } from "../fixtures/auth";

/** Locale-aware regex helpers for next-intl UI copy. */
export const UI = {
  upgradeBanner: /upgrade to pay guard pro|přejít na pay guard pro|перейти на pay guard pro/i,
  upgradeCta: /upgrade to pro|přejít na pro|перейти на pro/i,
  proOverlay: /^pro$/i,
  proActive: /pro is active|pro tarif|pro активен/i,
  manageSubscription:
    /manage subscription|spravovat předplatné|управлять подпиской/i,
  checkoutSuccess: /thank you|děkujeme|спасибо/i,
  checkoutCancelled:
    /checkout was cancelled|platba byla zrušena|оплата отменена/i,
  pdfProUpsell: /pdf — pro|pdf.*pro/i,
  recommendationTitle: /recommendation|doporučení|рекомендация/i,
  lockedHint:
    /pro features are preview-only|náhled|только предпросмотр/i,
} as const;

export function pricingPath(locale = E2E_LOCALE): string {
  return `/${locale}/pricing`;
}

export function proPath(segment: string, locale = E2E_LOCALE): string {
  return `/${locale}/pro/${segment}`;
}

/** Wait for toast/alert copy (next-intl toasts use role=alert or role=status). */
export async function waitForToast(
  page: Page,
  pattern: RegExp,
  timeout = 15_000
): Promise<Locator> {
  const toast = page
    .getByRole("alert")
    .filter({ hasText: pattern })
    .or(page.getByRole("status").filter({ hasText: pattern }))
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

  await page.locator("#funds").fill(funds);
  await page.getByLabel(/creditor|věřitel|кредитор/i).first().fill(creditor);
  await page
    .getByLabel(/amount|částka|сумма/i)
    .first()
    .fill(amount);
  await page
    .getByLabel(/due date|splatnost|срок/i)
    .first()
    .fill(dueDate);
  await page
    .getByRole("button", { name: /calculate|vypočítat|рассчитать/i })
    .click();
}

/** Wait until RecommendationCard heading is visible. */
export async function waitForRecommendation(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: UI.recommendationTitle })
  ).toBeVisible({ timeout: 20_000 });
}

/** ProFeatureGate upgrade banner region. */
export function proUpgradeBanner(page: Page): Locator {
  return page.getByRole("region", { name: UI.upgradeBanner });
}

/** ProFeatureGate locked overlay region. */
export function proLockedOverlay(page: Page): Locator {
  return page.getByRole("region", { name: UI.proOverlay });
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
