import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      include: ["apps/**/*.test.ts", "scripts/**/*.test.mjs", "packages/**/*.test.ts"],
    },
  },
]);