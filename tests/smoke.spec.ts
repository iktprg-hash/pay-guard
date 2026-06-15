import { test, expect } from "@playwright/test";
import { gotoExpectOk, expectApiOk } from "./helpers/server-health";

test.describe.configure({ mode: "parallel" });

test.describe("Pay Guard smoke", () => {
  test("login page loads", async ({ page }) => {
    await gotoExpectOk(page, "/cs/login");
    await expect(
      page.getByRole("heading", { name: /Přihlášení|Login|Вход/i })
    ).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await gotoExpectOk(page, "/cs/register");
    await expect(
      page.getByRole("heading", { name: /Registrace|Register|Регистрация/i })
    ).toBeVisible();
  });

  test("send-otp does not reveal missing accounts", async ({ request }) => {
    const res = await expectApiOk(request, "/api/auth/send-otp", {
      method: "POST",
      data: { email: "definitely-missing-user@pay-guard.test" },
    });

    const body = (await res.json()) as { ok?: boolean; code?: string };
    expect(body.ok).toBe(true);
    expect(body.code).toBeUndefined();
  });

  test("security headers present on pages", async ({ request }) => {
    const res = await expectApiOk(request, "/cs/login");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["content-security-policy"]).toContain(
      "default-src 'self'"
    );
  });

  test("locale manifest is served with PWA fields", async ({ request }) => {
    const res = await expectApiOk(request, "/cs/manifest.webmanifest");
    const body = (await res.json()) as {
      display?: string;
      start_url?: string;
      shortcuts?: unknown[];
    };
    expect(body.display).toBe("standalone");
    expect(body.start_url).toBe("/cs?source=pwa");
    expect(body.shortcuts?.length).toBeGreaterThanOrEqual(1);
  });
});
