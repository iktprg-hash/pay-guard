import { expect, type APIRequestContext, type Page, type Response } from "@playwright/test";
import { E2E_POLL_TIMEOUT } from "./e2e-timeouts";

const DEV_RESTART_HINT = "Run: npm run dev:restart";
const HYDRATION_POLL = [300, 500, 750, 1000] as const;

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

  await expect
    .poll(
      async () =>
        !(await page
          .getByText(/^internal server error$/i)
          .isVisible()
          .catch(() => false)),
      {
        timeout: E2E_POLL_TIMEOUT,
        intervals: [...HYDRATION_POLL],
      }
    )
    .toBe(true);

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
