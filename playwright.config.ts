import { defineConfig, devices } from "@playwright/test";

// Use a project-specific default port to avoid collisions with sibling apps.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3217);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Next dev can race while compiling locale routes, so keep smoke/visual checks serial.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/favicon.ico`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      INNGEST_DEV: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      RESEARCH_PROVIDER_MODE: "fixture",
    },
  },
});
