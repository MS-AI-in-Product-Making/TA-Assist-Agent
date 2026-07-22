import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      include: ["scripts/**/*.test.mjs"],
    },
  },
]);