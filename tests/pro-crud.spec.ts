import { test, expect, E2E_LOCALE } from "./fixtures/auth";
import { mockSubscriptionTier } from "./helpers/billing-mocks";
import { E2E_LONG_TIMEOUT } from "./helpers/e2e-timeouts";
import { openProRouteExpectUnlocked, waitForTierSettled } from "./helpers/test-utils";

test.describe.configure({ mode: "serial" });
test.slow();

test.describe("Pro CRUD — debts", () => {
  test.beforeEach(async ({ page }) => {
    const tier = mockSubscriptionTier(page);
    tier.setTier("pro");
    await waitForTierSettled(page, { timeout: E2E_LONG_TIMEOUT });
  });

  test("can open Add Debt sheet", async ({ page }) => {
    await openProRouteExpectUnlocked(page, "debts", /debts|dluhy|долги/i, {
      timeout: E2E_LONG_TIMEOUT,
    });
    await page
      .getByRole("button", { name: /add debt|přidat dluh|добавить долг/i })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: /add debt|přidat dluh|добавить долг/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("delete button opens AlertDialog, cancel keeps record", async ({ page }) => {
    await openProRouteExpectUnlocked(page, "debts", /debts|dluhy|долги/i, {
      timeout: E2E_LONG_TIMEOUT,
    });

    const deleteButtons = page.getByRole("button", {
      name: /delete|smazat|удалить/i,
    });
    const count = await deleteButtons.count();
    test.skip(count === 0, "No debts to test delete on — add one first");

    await deleteButtons.first().click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await page
      .getByRole("button", { name: /cancel|zrušit|отмена/i })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(deleteButtons.first()).toBeVisible();
  });
});
