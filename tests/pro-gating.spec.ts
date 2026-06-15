import { E2E_LOCALE, test, expect } from "./fixtures/auth";
import { mockSubscriptionTier } from "./helpers/billing-mocks";
import { createManualRecommendation } from "./helpers/manual-flow";
import {
  UI,
  pollUntilHidden,
  proLockedOverlay,
  proPath,
  proUpgradeBanner,
} from "./helpers/test-utils";

test.describe.configure({ mode: "parallel" });

const PRO_ROUTES = [
  { path: "dashboard", heading: /dashboard|přehled|дашборд/i },
  { path: "debts", heading: /debts|dluhy|долги/i },
  { path: "incomes", heading: /income|příjmy|доходы/i },
  { path: "expenses", heading: /expense|výdaje|расходы/i },
  { path: "forecast", heading: /forecast|prognóza|прогноз/i },
] as const;

test.describe("Pro gating", () => {
  test("shows upgrade gate on Pro dashboard for Free users", async ({ page }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("free");

    await test.step("Open Pro dashboard", async () => {
      await page.goto(proPath("dashboard"));
    });

    await test.step("Upgrade banner and locked overlay are visible", async () => {
      const banner = proUpgradeBanner(page);
      const overlay = proLockedOverlay(page);

      await expect.soft(banner).toBeVisible();
      await expect.soft(overlay).toBeVisible();
      await expect.soft(page.getByText(UI.lockedHint)).toBeVisible();
    });

    await test.step("Banner upgrade link points to pricing", async () => {
      const banner = proUpgradeBanner(page);
      await expect
        .soft(banner.getByRole("link", { name: UI.upgradeCta }))
        .toHaveAttribute("href", `/${E2E_LOCALE}/pricing`);
    });

    await test.step("Overlay upgrade button links to pricing", async () => {
      const overlayLink = proLockedOverlay(page).getByRole("link", {
        name: UI.upgradeCta,
      });
      await expect(overlayLink).toBeVisible();
      await expect(overlayLink).toHaveAttribute("href", /\/pricing$/);
    });
  });

  test("blocks Pro PDF export for Free users on recommendation card", async ({
    page,
    request,
    baseURL,
  }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("free");

    await test.step("Generate recommendation (same card as chat)", async () => {
      await createManualRecommendation(page);
    });

    await test.step("Shows Pro upsell link instead of PDF download button", async () => {
      const pdfUpsell = page.getByRole("link", { name: UI.pdfProUpsell });
      const pdfDownload = page.getByRole("button", {
        name: /download pdf|stáhnout pdf|скачать pdf/i,
      });

      await expect.soft(pdfUpsell).toBeVisible();
      await expect.soft(pdfUpsell).toHaveAttribute("href", /\/pricing$/);
      await expect.soft(pdfDownload).toHaveCount(0);
    });

    await test.step("Server PDF API rejects Free tier", async () => {
      test.skip(!baseURL, "baseURL is required");
      const res = await request.post(`${baseURL}/api/pdf/recommendation`, {
        data: {
          locale: "cs",
          recommendation: {
            summary: "E2E test",
            payFirst: [],
            remainingFunds: 0,
            warnings: [],
            lifeBuffer: 0,
          },
          profile: { availableFunds: 1000, debts: [] },
        },
      });
      expect.soft(res.status()).toBeGreaterThanOrEqual(401);
      expect(res.status()).toBeLessThanOrEqual(403);
    });
  });

  test("grants full access to all Pro pages for Pro users", async ({ page }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("pro");

    for (const route of PRO_ROUTES) {
      await test.step(`Pro route /pro/${route.path}`, async () => {
        await page.goto(proPath(route.path));
        await expect.soft(
          page.getByRole("heading", { name: route.heading })
        ).toBeVisible();
        await expect(proUpgradeBanner(page)).toHaveCount(0);
      });
    }
  });

  test("ProFeatureGate unlocks after tier upgrade (poll)", async ({ page }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("free");

    await page.goto(proPath("debts"));

    await test.step("Gate visible while Free", async () => {
      await expect.soft(proUpgradeBanner(page)).toBeVisible();
      await expect.soft(proLockedOverlay(page)).toBeVisible();
    });

    await test.step("Upgrade tier mock → gate disappears", async () => {
      tier.setTier("pro");
      await page.reload();

      await pollUntilHidden(proUpgradeBanner(page));
      await pollUntilHidden(proLockedOverlay(page));

      await expect(
        page.getByRole("heading", { name: /debts|dluhy|долги/i })
      ).toBeVisible();
    });
  });

  test("ProFeatureGate renders blur overlay and upgrade CTA", async ({
    page,
  }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("free");

    await page.goto(proPath("debts"));

    await test.step("Gate banner links to pricing", async () => {
      const upgradeLink = proUpgradeBanner(page).getByRole("link", {
        name: UI.upgradeCta,
      });
      await expect.soft(upgradeLink).toBeVisible();
      await expect(upgradeLink).toHaveAttribute("href", /\/pricing$/);
    });

    await test.step("Locked overlay is visible with upgrade CTA", async () => {
      const overlay = proLockedOverlay(page);
      await expect.soft(overlay).toBeVisible();
      await expect.soft(
        overlay.getByRole("link", { name: UI.upgradeCta })
      ).toBeVisible();
    });

    await test.step("Preview content is blurred (aria-hidden wrapper)", async () => {
      const blurredPreview = page.locator("[aria-hidden='true'].blur-sm");
      await expect.soft(blurredPreview.first()).toBeVisible();
    });
  });
});
