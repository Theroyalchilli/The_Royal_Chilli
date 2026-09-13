import { defineConfig, devices } from "@playwright/test";

// Critical-path E2E coverage (checklist §9) — runs against a local `next dev`
// server by default. Point PLAYWRIGHT_BASE_URL at a deployed environment to
// run the same specs there instead of starting a local server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npx next dev -p 3010",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
