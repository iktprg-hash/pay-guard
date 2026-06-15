import type { Page } from "@playwright/test";
import { E2E_LOCALE } from "../fixtures/auth";
import { fillFinancialForm, waitForRecommendation } from "./test-utils";

/** Fill manual form and wait for RecommendationCard (shared with chat UI). */
export async function createManualRecommendation(page: Page): Promise<void> {
  await page.goto(`/${E2E_LOCALE}/manual`);
  await fillFinancialForm(page);
  await waitForRecommendation(page);
}
