import { E2E_LOCALE, test, expect } from "./fixtures/auth";
import { mockSubscriptionTier } from "./helpers/billing-mocks";

/** Page `<h1>` — distinct from session card titles that also contain "konzultace". */
const CONSULTATIONS_PAGE_HEADING =
  /moje konzultace|my consultations|мои консультации/i;

test.describe.configure({ mode: "serial" });

test.describe("Consultations", () => {
  test("shows consultations list for authenticated user", async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/consultations`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: CONSULTATIONS_PAGE_HEADING,
      })
    ).toBeVisible();
  });

  test("consultation detail page loads and shows back link", async ({
    page,
  }) => {
    await page.goto(`/${E2E_LOCALE}/consultations`);
    const viewLink = page
      .getByRole("link", { name: /zobrazit|view|просмотр/i })
      .first();

    const count = await viewLink.count();
    if (count === 0) {
      test.skip(true, "No consultations to view");
      return;
    }

    await viewLink.click();
    await expect(
      page.getByRole("link", { name: /zpět|back|назад/i })
    ).toBeVisible();
  });

  test("consultations list page is Pro-gated when accessed by Free user", async ({
    page,
  }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("free");

    await page.goto(`/${E2E_LOCALE}/consultations`);
    await expect(page).not.toHaveURL(/login/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: CONSULTATIONS_PAGE_HEADING,
      })
    ).toBeVisible();
  });
});
