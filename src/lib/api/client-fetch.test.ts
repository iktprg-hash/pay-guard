import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import {
  apiFetch,
  apiFetchResponse,
  isNetworkError,
} from "@/lib/api/client-fetch";

function stubOnlineFetch(response: Response) {
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

describe("apiFetchResponse", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns response on success", async () => {
    stubOnlineFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const res = await apiFetchResponse("/api/test");
    expect(res.ok).toBe(true);
  });

  it("throws AppError using API error code from body", async () => {
    stubOnlineFetch(
      new Response(
        JSON.stringify({
          error: "RATE_LIMITED",
          message: "Слишком много запросов.",
        }),
        { status: 429 }
      )
    );

    await expect(apiFetchResponse("/api/test")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
    });
  });

  it("maps HTTP status when body has no code", async () => {
    stubOnlineFetch(new Response("forbidden", { status: 403 }));

    await expect(apiFetchResponse("/api/test")).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("throws NETWORK_ERROR AppError when offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    await expect(apiFetchResponse("/api/test")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("maps 500 responses to INTERNAL_ERROR", async () => {
    stubOnlineFetch(new Response("server error", { status: 500 }));

    await expect(apiFetchResponse("/api/test")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      statusCode: 500,
    });
  });

  it("wraps fetch TypeError as NETWORK_ERROR", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    await expect(apiFetchResponse("/api/test")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});

describe("isNetworkError", () => {
  it("detects TypeError and offline markers", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("OFFLINE"))).toBe(true);
    expect(isNetworkError(new AppError("PRO_REQUIRED", "pro", 403))).toBe(false);
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses JSON body on success", async () => {
    stubOnlineFetch(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com" }), {
        status: 200,
      })
    );

    const data = await apiFetch<{ url: string }>("/api/billing/checkout");
    expect(data.url).toContain("stripe.com");
  });
});
