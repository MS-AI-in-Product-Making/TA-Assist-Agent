import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(import.meta.dirname, "..");

const retainedPaths = [
  ".github/skills/ta-assist-agent/SKILL.md",
  "scripts/run-f1-full-validation.mjs",
  "scripts/run-f2-full-validation.mjs",
  "scripts/run-f3-full-validation.mjs",
  "scripts/run-f4-full-validation.mjs",
  "scripts/run-f5-full-validation.mjs",
  "scripts/run-f6-full-validation.mjs",
  "apps/f7-local-api",
  "apps/f7-web",
  "test/e2e/f6-governed-pdf.spec.ts",
  "test/e2e/f7-bulk-measurement-import.spec.ts",
  "test/e2e/fixtures/anonymous-workbook-fixture.ts",
  "test/e2e/fixtures/f7-bulk-measurement-import.ts",
];

const retiredParticipantPaths = [
  "apps/vscode-extension",
  "apps/cli/src/commands/agent-launcher.ts",
  "apps/cli/src/commands/agent.test.ts",
];

const retiredRuntimeGraphPaths = [
  "apps/workbench-server",
  "apps/workbench-web",
  "packages/workbench",
  "packages/conversation",
  "packages/agent-runtime",
  "packages/contracts/src/f8-contracts.ts",
  "packages/contracts/src/f8-contracts.test.ts",
  "test/f8-e2e/ado-fixture-contract.mjs",
  "test/f8-e2e/ado-fixture-contract.test.mjs",
  "test/f8-e2e/chat-entry-server.mjs",
  "test/f8-e2e/chat-entry.spec.ts",
  "test/f8-e2e/engineering-workspace.spec.ts",
  "test/f8-e2e/f7-placeholder.spec.ts",
  "test/f8-e2e/main-flow.spec.ts",
  "test/f8-e2e/product-output.spec.ts",
  "test/f8-e2e/security.spec.ts",
  "test/f8-e2e/server.mjs",
  "test/f8-e2e/workbench-fixture.ts",
  "scripts/f8-ado-fixture-contract.test.mjs",
  "scripts/verify-chat-entry-e2e.mjs",
  "scripts/workbench-review-import-boundary.test.mjs",
];

const workflowScripts = [
  "workflow:f1",
  "workflow:f2",
  "workflow:f3",
  "workflow:f4",
  "workflow:f5",
  "workflow:f6",
  "dev:f7",
  "dev:f7:api",
  "dev:f7:web",
  "build:f7:web",
];

const retiredWorkspaceReferences = [
  "./apps/workbench-server",
  "./packages/agent-runtime",
  "./packages/conversation",
  "./packages/workbench",
];

const retiredLockfileEntries = [
  "apps/workbench-server",
  "apps/workbench-web",
  "packages/agent-runtime",
  "packages/conversation",
  "packages/workbench",
  "node_modules/@ai-assist/agent-runtime",
  "node_modules/@ai-assist/conversation",
  "node_modules/@ai-assist/workbench",
  "node_modules/@ai-assist/workbench-server",
  "node_modules/@ai-assist/workbench-web",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

describe("F8 retirement retained surfaces", () => {
  it.each(retainedPaths)("keeps %s present", (retainedPath) => {
    expect(fs.existsSync(path.join(rootDir, retainedPath))).toBe(true);
  });

  it.each(retiredParticipantPaths)("removes retired participant surface %s", (retiredPath) => {
    expect(fs.existsSync(path.join(rootDir, retiredPath))).toBe(false);
  });

  it.each(retiredRuntimeGraphPaths)("removes retired F8 runtime graph path %s", (retiredPath) => {
    expect(fs.existsSync(path.join(rootDir, retiredPath))).toBe(false);
  });

  it("keeps the direct F1-F6 workflows and F7 scripts defined in package.json", () => {
    const scripts = readJson("package.json").scripts ?? {};

    for (const scriptName of workflowScripts) {
      expect(scripts[scriptName]).toBeDefined();
    }
  });

  it("removes retired F8 workspace references from root configuration", () => {
    const rootTsconfig = readJson("tsconfig.json");
    const references = (rootTsconfig.references ?? []).map(({ path: referencePath }) => referencePath);

    for (const retiredReference of retiredWorkspaceReferences) {
      expect(references).not.toContain(retiredReference);
    }

    const packageJson = readJson("package.json");
    expect(packageJson.overrides).toBeUndefined();

    const packageLock = readJson("package-lock.json");
    const lockfilePackages = packageLock.packages ?? {};
    for (const retiredEntry of retiredLockfileEntries) {
      expect(lockfilePackages[retiredEntry]).toBeUndefined();
    }
  });

  it("keeps repository ignores and e2e wiring scoped to retained surfaces", () => {
    const gitignore = fs.readFileSync(path.join(rootDir, ".gitignore"), "utf8");
    expect(gitignore).not.toContain("F8-session-output");

    const ciExample = fs.readFileSync(path.join(rootDir, ".github/ci.example.yml"), "utf8");
    expect(ciExample).not.toContain("workbench");
    expect(ciExample).not.toContain("vsix");
  });

  it("removes deleted F8 path exceptions from eslint config", () => {
    const eslintConfig = fs.readFileSync(path.join(rootDir, "eslint.config.mjs"), "utf8");

    expect(eslintConfig).not.toContain("apps/workbench-server/src/sse.ts");
    expect(eslintConfig).not.toContain("packages/agent-runtime/src/context-builder.ts");
    expect(eslintConfig).not.toContain("packages/agent-runtime/src/runtime.ts");
    expect(eslintConfig).not.toContain("test/f8-e2e/server.mjs");
    expect(eslintConfig).toContain("scripts/f1-composed-snapshot-detection.mjs");
  });
});
