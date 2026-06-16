import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { loadEnvLocal } from "./scripts/load-env-local.mjs";

loadEnvLocal(process.cwd());

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const authFile = path.join("playwright", ".auth", "user.json");
const skipWebServer = Boolean(process.env.E2E_NO_WEBSERVER);
const isCI = Boolean(process.env.CI);
const webServerTimeout = isCI ? 240_000 : 120_000;
const healthUrl = `${baseURL}/api/health`;

export default defineConfig({
  testDir: "tests",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  grep: process.env.E2E_GREP ? new RegExp(process.env.E2E_GREP, "i") : undefined,
  grepInvert: process.env.E2E_GREP_INVERT
    ? new RegExp(process.env.E2E_GREP_INVERT, "i")
    : undefined,
  retries: isCI ? 3 : 1,
  timeout: isCI ? 150_000 : 90_000,
  maxFailures: isCI ? 5 : undefined,
  expect: { timeout: isCI ? 25_000 : 15_000 },
  workers: isCI ? 1 : 2,
  reporter: isCI
    ? [
        ["dot"],
        ["html", { open: "never" }],
      ]
    : [
        ["list", { printSteps: true }],
        ["html", { open: "on-failure" }],
      ],
  use: {
    baseURL,
    testIdAttribute: "data-testid",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: isCI ? 25_000 : 15_000,
    navigationTimeout: isCI ? 45_000 : 30_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      testMatch: /(smoke|auth-chat)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-authenticated",
      dependencies: ["setup"],
      testMatch: /(checkout-flow|pro-gating)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
    {
      name: "mobile",
      dependencies: ["setup", "chromium-authenticated"],
      testMatch: /pro-gating\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        storageState: authFile,
      },
    },
  ],
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: healthUrl,
          reuseExistingServer: !isCI,
          timeout: webServerTimeout,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
});
