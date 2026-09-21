import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: { browserName: "chromium", channel: "msedge", headless: true, trace: "retain-on-failure" },
});
