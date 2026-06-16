/** Shared E2E timeouts — longer in CI for cold prod server + hydration. */
export const IS_E2E_CI = Boolean(process.env.CI);

export const E2E_LONG_TIMEOUT = IS_E2E_CI ? 45_000 : 30_000;
export const E2E_POLL_TIMEOUT = IS_E2E_CI ? 45_000 : 30_000;
export const E2E_TOAST_TIMEOUT = IS_E2E_CI ? 30_000 : 20_000;
export const E2E_TIER_TIMEOUT = IS_E2E_CI ? 40_000 : 25_000;
