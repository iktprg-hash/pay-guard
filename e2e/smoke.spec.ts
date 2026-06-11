import { test, expect } from "@playwright/test";

test.describe("Pay Guard smoke", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/cs/login");
    await expect(page.getByRole("heading", { name: /Přihlášení|Login|Вход/i })).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/cs/register");
    await expect(page.getByRole("heading", { name: /Registrace|Register|Регистрация/i })).toBeVisible();
  });

  test("send-otp does not reveal missing accounts", async ({ request }) => {
    const res = await request.post("/api/auth/send-otp", {
      data: { email: "definitely-missing-user@pay-guard.test" },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as { ok?: boolean; code?: string };
    expect(body.ok).toBe(true);
    expect(body.code).toBeUndefined();
  });

  test("security headers present on pages", async ({ request }) => {
    const res = await request.get("/cs/login");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
  });
});
