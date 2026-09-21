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

const activeProductDocs = [
  "docs/README.md",
  "docs/01-architecture.md",
  "docs/02-end-to-end-flow.md",
  "docs/03-differentiation.md",
  "docs/04-feature-breakdown.md",
  "docs/governance/feature-register.md",
];

const retiredDocLiterals = [
  "@ta-assist",
  "onChatParticipant:ta-assist",
  "F8-session-output",
  "apps/workbench-server",
  "apps/workbench-web",
];

const retiredHistoricalDocPaths = [
  "docs/superpowers/plans/2026-07-28-f8-public-workflow-contract.md",
  "docs/superpowers/plans/2026-08-24-f8-user-interaction-workbench.md",
  "docs/superpowers/plans/2026-08-26-f8-ta-engineering-workspace-ui.md",
  "docs/superpowers/plans/2026-08-26-f8-web-ado-acceptance.md",
  "docs/superpowers/plans/2026-08-27-f8-engineering-workspace-v2.md",
  "docs/superpowers/plans/2026-08-28-f8-ado-workspace.md",
  "docs/superpowers/plans/2026-08-28-f8-conversation-output-policy.md",
  "docs/superpowers/plans/2026-08-28-f8-english-workspace.md",
  "docs/superpowers/plans/2026-08-28-f8-scenario-charts.md",
  "docs/superpowers/plans/2026-08-31-f8-ui-op1.md",
  "docs/superpowers/specs/2026-07-28-f8-public-workflow-contract-design.md",
  "docs/superpowers/specs/2026-08-24-f8-user-interaction-workbench-design.md",
  "docs/superpowers/specs/2026-08-26-f8-ta-engineering-workspace-ui-design.md",
  "docs/superpowers/specs/2026-08-26-f8-web-ado-acceptance-design.md",
  "docs/superpowers/specs/2026-08-26-f8-workbench-product-hardening-design.md",
  "docs/superpowers/specs/2026-08-27-f8-engineering-workspace-v2-design.md",
  "docs/superpowers/specs/2026-08-28-f8-web-projection-optimization-design.md",
  "docs/superpowers/specs/2026-08-31-f8-ui-op1-design.md",
  "docs/superpowers/plans/2026-08-31-chat-to-web-ta-analysis.md",
  "docs/superpowers/specs/2026-08-31-chat-to-web-ta-analysis-design.md",
  "docs/superpowers/plans/2026-09-01-measured-capability-feedback-beta.md",
  "docs/superpowers/plans/2026-09-01-ta-assist-agent-ta-workbook-beta.md",
  "docs/superpowers/specs/2026-09-01-ta-assist-beta-agent-architecture-design.md",
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

  it.each(retiredHistoricalDocPaths)("deletes retired participant or F8 history %s", (retiredPath) => {
    expect(fs.existsSync(path.join(rootDir, retiredPath))).toBe(false);
  });

  it("removes retired F8 literals from active product documentation", () => {
    const violations = [];

    for (const relativePath of activeProductDocs) {
      const content = fs.readFileSync(path.join(rootDir, relativePath), "utf8");

      for (const literal of retiredDocLiterals) {
        if (content.includes(literal)) {
          violations.push(`${relativePath}: ${literal}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("documents active entry as Copilot Skills plus direct workflows", () => {
    const readme = fs.readFileSync(path.join(rootDir, "docs/README.md"), "utf8");
    const architecture = fs.readFileSync(path.join(rootDir, "docs/01-architecture.md"), "utf8");
    const flow = fs.readFileSync(path.join(rootDir, "docs/02-end-to-end-flow.md"), "utf8");

    expect(readme).toContain("Copilot Skills");
    expect(readme).toContain("direct governed workflows");
    expect(architecture).toContain("Copilot Skills");
    expect(architecture).toContain("workflow:f2:excel");
    expect(flow).toContain("ta-assist-agent");
    expect(flow).toContain("workflow:f5");
  });
});
