import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/f8-e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { browserName: "chromium", channel: "msedge", headless: true, trace: "retain-on-failure" },
});
