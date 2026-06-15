import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const authFile = path.join("playwright", ".auth", "user.json");
const skipWebServer = Boolean(process.env.E2E_NO_WEBSERVER);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: isCI,
  grep: process.env.E2E_GREP ? new RegExp(process.env.E2E_GREP, "i") : undefined,
  grepInvert: process.env.E2E_GREP_INVERT
    ? new RegExp(process.env.E2E_GREP_INVERT, "i")
    : undefined,
  retries: isCI ? 2 : 0,
  timeout: 60_000,
  maxFailures: isCI ? 3 : undefined,
  expect: { timeout: 10_000 },
  workers: isCI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: isCI ? "never" : "on-failure" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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
      dependencies: ["setup"],
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
          url: `${baseURL}/cs/login`,
          reuseExistingServer: true,
          timeout: 90_000,
        },
      }),
});
