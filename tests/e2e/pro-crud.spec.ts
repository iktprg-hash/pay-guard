import { test, expect } from "@playwright/test";

test.describe("Pro CRUD — Pro gate runs before schema/UUID validation", () => {
  test("POST /api/sessions → 403 (Pro gate)", async ({ request }) => {
    const res = await request.post("/api/sessions", {
      data: { locale: "cs" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });

  test("GET /api/sessions → 403 (Pro gate)", async ({ request }) => {
    const res = await request.get("/api/sessions");
    expect(res.status()).toBe(403);
  });

  test("GET /api/sessions/[valid-uuid] → 403 (Pro gate)", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/sessions/12345678-1234-1234-1234-123456789abc"
    );
    expect(res.status()).toBe(403);
  });

  test("GET /api/sessions/[non-uuid] → 403 (Pro gate before UUID validation)", async ({
    request,
  }) => {
    const res = await request.get("/api/sessions/not-a-uuid-at-all");
    // requireProApiWithRateLimit runs first → 403, UUID validation never reached
    expect(res.status()).toBe(403);
  });

  test("POST /api/chat/history → 403 (Pro gate)", async ({ request }) => {
    const res = await request.post("/api/chat/history", {
      data: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        messages: [],
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });

  test("GET /api/chat/history → 403 (Pro gate)", async ({ request }) => {
    const res = await request.get("/api/chat/history");
    expect(res.status()).toBe(403);
  });

  test("POST /api/billing/sync → not 2xx without valid Stripe config or Pro", async ({
    request,
  }) => {
    const res = await request.post("/api/billing/sync", {
      headers: { "Content-Type": "application/json" },
    });
    // 503 Stripe not configured, or 422 email not found in Stripe
    // Either way — never 200 in test env
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
