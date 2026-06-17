import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { apiFetch, apiFetchResponse } from "@/lib/api/client-fetch";

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
