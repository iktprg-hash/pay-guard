import { expect, type APIRequestContext, type Page, type Response } from "@playwright/test";

const DEV_RESTART_HINT = "Run: npm run dev:restart";

/** Fail fast when Next.js dev server returns 5xx (often corrupted .next cache). */
export function assertHttpOk(
  response: Response | null,
  context: string
): asserts response is Response {
  expect(
    response,
    `${context}: no response — is dev server running? ${DEV_RESTART_HINT}`
  ).toBeTruthy();
  expect(
    response!.ok(),
    `${context}: HTTP ${response!.status()}. ${DEV_RESTART_HINT}`
  ).toBeTruthy();
}

/** Navigate and assert the page is not a Next.js 500 error page. */
export async function gotoExpectOk(page: Page, url: string): Promise<Response> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  assertHttpOk(response, `GET ${url}`);
  await expect(
    page.getByText(/^internal server error$/i),
    `GET ${url} rendered 500 page. ${DEV_RESTART_HINT}`
  ).toHaveCount(0);
  return response!;
}

/** API preflight for request-based smoke tests. */
export async function expectApiOk(
  request: APIRequestContext,
  path: string,
  init?: Parameters<APIRequestContext["fetch"]>[1]
): Promise<Awaited<ReturnType<APIRequestContext["get"]>>> {
  const res = await request.fetch(path, init);
  expect(
    res.ok(),
    `${path} returned HTTP ${res.status()}. ${DEV_RESTART_HINT}`
  ).toBeTruthy();
  return res;
}
