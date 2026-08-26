import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          testTimeout: 60_000,
          maxWorkers: 4,
          include: ["apps/**/*.test.ts", "scripts/**/*.test.mjs", "packages/**/*.test.ts"],
          exclude: ["apps/f7-web/**/*.test.ts", "scripts/f4-excel-regression.test.mjs"],
        },
      },
      {
        plugins: [vue()],
        test: {
          name: "f7-web",
          include: ["apps/f7-web/**/*.test.ts"],
          environment: "jsdom",
        },
      },
    ],
  },
});
