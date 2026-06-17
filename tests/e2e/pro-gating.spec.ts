import {
  test,
  expect,
  ensureFreeSubscriptionTier,
  getTestUserCredentials,
  syncPageCookiesFromRequest,
} from "../fixtures/auth";
import { pollExpectProGate403 } from "../helpers/test-utils";
import { E2E_POLL_TIMEOUT } from "../helpers/e2e-timeouts";

const L = process.env.E2E_LOCALE ?? "cs";

const CHAT_HISTORY_POST_BODY = {
  sessionId: "00000000-0000-0000-0000-000000000000",
  messages: [],
};

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

test.describe("Pro gating — free user cannot access Pro API routes", () => {
  test.beforeAll(async ({ request, baseURL }) => {
    if (!baseURL) return;
    await ensureFreeSubscriptionTier(request, getTestUserCredentials());
  });

  test.describe("unauthenticated guest", () => {
    test("GET /api/chat/history → 401 for unauthenticated guest", async ({
      guestRequest,
    }) => {
      const res = await guestRequest.get("/api/chat/history");
      expect(res.status()).toBe(401);
    });

    test("POST /api/chat/history → 401 for unauthenticated guest", async ({
      guestRequest,
    }) => {
      const res = await guestRequest.post("/api/chat/history", {
        data: CHAT_HISTORY_POST_BODY,
        headers: JSON_HEADERS,
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe("authenticated free user", () => {
    test.beforeEach(async ({}, testInfo) => {
      if (testInfo.project.name === "mobile") {
        test.slow();
      }
    });

    test("GET /api/sessions → 403 for free user", async ({ request }) => {
      await pollExpectProGate403(() => request.get("/api/sessions"));
    });

    test("GET /api/sessions/[uuid] → 403 for free user", async ({ request }) => {
      await pollExpectProGate403(() =>
        request.get("/api/sessions/00000000-0000-0000-0000-000000000000")
      );
    });

    test("POST /api/sessions → 403 for free user", async ({ request }) => {
      await pollExpectProGate403(() =>
        request.post("/api/sessions", {
          data: { locale: "cs" },
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    test("GET /api/chat/history → 403 for free user", async ({ request }) => {
      await pollExpectProGate403(() => request.get("/api/chat/history"));
    });

    test("POST /api/chat/history → 403 for free user", async ({ request }) => {
      await pollExpectProGate403(() =>
        request.post("/api/chat/history", {
          data: CHAT_HISTORY_POST_BODY,
          headers: JSON_HEADERS,
        })
      );
    });

    test("settings page accessible to authenticated user", async ({
      page,
      request,
    }) => {
      await syncPageCookiesFromRequest(page, request);

      await expect(async () => {
        await page.goto(`/${L}/settings`, { waitUntil: "domcontentloaded" });
        if (page.url().includes("/login")) {
          throw new Error("settings redirected to login");
        }
      }).toPass({ timeout: E2E_POLL_TIMEOUT, intervals: [500, 1000] });

      await expect(page.locator("body")).toBeVisible();
    });

    // This test also runs in the "mobile" Playwright project (Pixel 7 viewport)
    test("pricing page renders on current viewport", async ({ page }) => {
      await page.goto(`/${L}/pricing`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page).not.toHaveURL(/error/);
    });
  });
});
