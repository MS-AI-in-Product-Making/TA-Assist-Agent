import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      include: ["apps/**/*.test.ts", "scripts/**/*.test.mjs", "packages/**/*.test.ts"],
      exclude: ["scripts/f4-excel-regression.test.mjs"],
    },
  },
  {
    test: {
      name: "workbench-web",
      include: ["apps/workbench-web/src/**/*.test.ts", "apps/workbench-web/src/**/*.test.tsx"],
      environment: "jsdom",
      setupFiles: ["apps/workbench-web/src/test-setup.ts"],
    },
  },
]);