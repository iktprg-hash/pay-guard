import { test, expect } from "@playwright/test";

test.describe("Auth and chat flow", () => {
  test("redirects unauthenticated users from chat to login", async ({ page }) => {
    await page.goto("/cs");
    await expect(page).toHaveURL(/\/cs\/login/);
  });

  test("login page offers navigation to register", async ({ page }) => {
    await page.goto("/cs/login");
    await expect(
      page.getByRole("heading", { name: /Přihlášení|Login|Вход/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Registrace|Register|Регистрация/i })
    ).toBeVisible();
  });

  test("register page offers navigation to login", async ({ page }) => {
    await page.goto("/cs/register");
    await expect(
      page.getByRole("heading", { name: /Registrace|Register|Регистрация/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Přihlášení|Login|Вход/i })
    ).toBeVisible();
  });

  test("chat API returns 401 without authenticated session", async ({
    request,
  }) => {
    const res = await request.post("/api/chat", {
      data: {
        messages: [{ role: "user", content: "Ahoj" }],
        profile: { availableFunds: 5000, debts: [] },
        locale: "cs",
      },
    });

    expect(res.status()).toBe(401);
  });

  test("grok consent API returns 401 without authenticated session", async ({
    request,
  }) => {
    const res = await request.get("/api/auth/grok-consent");
    expect(res.status()).toBe(401);
  });

  test("prioritize API returns 401 without authenticated session", async ({
    request,
  }) => {
    const res = await request.post("/api/prioritize", {
      data: {
        profile: {
          availableFunds: 10_000,
          debts: [
            {
              id: "d1",
              creditor: "ČEZ",
              amount: 3000,
              category: "utilities",
              dueDate: "2026-06-20",
            },
          ],
        },
        locale: "cs",
      },
    });

    expect(res.status()).toBe(401);
  });
});
