import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/runtime/**", "**/exports/**", "**/.tmp/**", "**/assets/workbench/**", "**/test-results/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    files: ["apps/workbench-server/src/sse.ts", "packages/agent-runtime/src/context-builder.ts", "packages/agent-runtime/src/runtime.ts"],
    rules: { "no-control-regex": "off" },
  },
  {
    files: ["scripts/f2-excel-runner.mjs", "scripts/run-f3-full-validation.mjs"],
    languageOptions: { globals: { crypto: "readonly", AbortController: "readonly" } },
  },
  {
    files: ["test/f8-e2e/server.mjs"],
    languageOptions: { globals: { Buffer: "readonly" } },
  },
];