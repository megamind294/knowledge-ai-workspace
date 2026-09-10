import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["junit", { outputFile: "test-results/browser-results.xml" }]]
    : "line",
  outputDir: "test-results/playwright",
  use: {
    baseURL: process.env.KEYSTONE_E2E_BASE_URL ?? "http://127.0.0.1:8080",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
