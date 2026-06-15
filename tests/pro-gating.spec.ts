import { E2E_LOCALE, test, expect } from "./fixtures/auth";
import { mockSubscriptionTier } from "./helpers/billing-mocks";
import { createManualRecommendation } from "./helpers/manual-flow";
import {
  UI,
  expectProGateWithBlur,
  latestPdfProUpsellLink,
  openProRouteExpectGate,
  openProRouteExpectUnlocked,
  pollForGateFullyUnlocked,
  proBannerUpgradeLink,
  proBlurredPreview,
  proLockedOverlay,
  proOverlayUpgradeLink,
  proPageHeading,
  proUpgradeBanner,
  refreshSubscriptionTier,
} from "./helpers/test-utils";

/** Serial — tier mocks + Pro routes share one dev server; parallel caused HTTP 500. */
test.describe.configure({ mode: "serial" });

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
      await openProRouteExpectGate(page, "dashboard");
    });

    await test.step("Upgrade banner, blur, and locked overlay are visible", async () => {
      await expectProGateWithBlur(page);
    });

    await test.step("Banner upgrade link points to pricing", async () => {
      await expect
        .soft(proBannerUpgradeLink(page))
        .toHaveAttribute("href", `/${E2E_LOCALE}/pricing`);
    });

    await test.step("Overlay upgrade button links to pricing", async () => {
      const overlayLink = proOverlayUpgradeLink(page);
      await expect.soft(overlayLink).toBeVisible();
      await expect
        .soft(overlayLink)
        .toHaveAttribute("href", `/${E2E_LOCALE}/pricing`);
    });
  });

  test("blocks Pro PDF export for Free users on recommendation card", async ({
    page,
    request,
    baseURL,
  }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("free");
    await refreshSubscriptionTier(page);

    await test.step("Generate recommendation (same card as chat)", async () => {
      await createManualRecommendation(page);
    });

    await test.step("Shows Pro upsell link instead of PDF download button", async () => {
      const pdfUpsell = latestPdfProUpsellLink(page);
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
          locale: E2E_LOCALE,
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
      if (res.status() === 200) {
        test.skip(
          true,
          "E2E user has Pro in Supabase — set profiles.subscription_tier to free for this test."
        );
      }
      expect.soft(res.status()).toBeGreaterThanOrEqual(401);
      expect.soft(res.status()).toBeLessThanOrEqual(403);
    });
  });

  test("grants full access to all Pro pages for Pro users", async ({ page }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("pro");

    for (const route of PRO_ROUTES) {
      await test.step(`Pro route /${E2E_LOCALE}/pro/${route.path}`, async () => {
        await openProRouteExpectUnlocked(page, route.path, route.heading);

        await expect.soft(proPageHeading(page, route.heading)).toBeVisible();
        await expect.soft(
          page.getByRole("region", { name: UI.upgradeBanner })
        ).toHaveCount(0);
      });
    }
  });

  test("ProFeatureGate unlocks after tier upgrade (poll)", async ({ page }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("free");

    await test.step("Gate visible while Free", async () => {
      await openProRouteExpectGate(page, "debts");
      await expectProGateWithBlur(page);
    });

    await test.step("Upgrade tier mock → gate and overlay disappear", async () => {
      tier.setTier("pro");
      await page.reload();

      await pollForGateFullyUnlocked(page);

      await expect.soft(
        proPageHeading(page, /debts|dluhy|долги/i)
      ).toBeVisible();
      await expect.soft(proUpgradeBanner(page)).toHaveCount(0);
      await expect.soft(proLockedOverlay(page)).toHaveCount(0);
    });
  });

  test("ProFeatureGate renders blur overlay and upgrade CTA", async ({
    page,
  }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("free");

    await test.step("Gate with blur is visible on debts page", async () => {
      await openProRouteExpectGate(page, "debts");
      await expectProGateWithBlur(page);
    });

    await test.step("Gate banner links to pricing", async () => {
      const upgradeLink = proBannerUpgradeLink(page);
      await expect.soft(upgradeLink).toBeVisible();
      await expect
        .soft(upgradeLink)
        .toHaveAttribute("href", `/${E2E_LOCALE}/pricing`);
    });

    await test.step("Locked overlay is visible with upgrade CTA", async () => {
      const overlay = proLockedOverlay(page);
      await expect.soft(overlay).toBeVisible();
      await expect.soft(proOverlayUpgradeLink(page)).toBeVisible();
    });

    await test.step("Preview content is blurred (aria-hidden wrapper)", async () => {
      await expect.soft(proBlurredPreview(page).first()).toBeVisible();
    });
  });
});
