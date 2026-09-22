import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: "npm run dev:f7",
    url: "http://127.0.0.1:5177",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: { browserName: "chromium", channel: "msedge", headless: true, trace: "retain-on-failure" },
});
