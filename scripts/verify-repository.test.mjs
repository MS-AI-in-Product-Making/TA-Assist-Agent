import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { findEngineeringLanguageViolations, hasCjkText, isEnglishEngineeringPath, isForbiddenRepositoryPath } from "./verify-repository.mjs";

const COMPOSED_REPORT_ARTIFACT_TOKEN = ["Feature6", "Composed", "Report"].join("-");
const RETAINED_PATHS = [
  ".github/skills/ta-assist-agent/SKILL.md",
  "scripts/run-f1-full-validation.mjs",
  "scripts/run-f2-full-validation.mjs",
  "scripts/run-f3-full-validation.mjs",
  "scripts/run-f4-full-validation.mjs",
  "scripts/run-f5-full-validation.mjs",
  "scripts/run-f6-full-validation.mjs",
  "apps/f7-local-api",
  "apps/f7-web",
];
const RETAINED_WORKFLOW_SCRIPTS = [
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

function normalizeRepositoryPath(repositoryPath) {
  return repositoryPath.replaceAll("\\", "/");
}

function isActiveRuntimeOrCurrentDocumentationPath(repositoryPath) {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);
  if (normalizedPath.endsWith(".test.mjs") || normalizedPath.endsWith(".test.ts")) return false;
  if (normalizedPath.startsWith("docs/superpowers/specs/") || normalizedPath.startsWith("docs/superpowers/plans/")) return false;
  return normalizedPath === "README.md"
    || normalizedPath.startsWith(".github/skills/")
    || normalizedPath.startsWith("apps/")
    || normalizedPath.startsWith("docs/")
    || normalizedPath.startsWith("packages/")
    || normalizedPath.startsWith("scripts/");
}

function activeComposedReportArtifactReferences(repositoryPath) {
  const trackedAndUntracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: repositoryPath,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .filter(isActiveRuntimeOrCurrentDocumentationPath);

  return trackedAndUntracked.flatMap((relativePath) => {
    const filePath = resolve(repositoryPath, relativePath);
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, "utf8");
    return content.includes(COMPOSED_REPORT_ARTIFACT_TOKEN) ? [normalizeRepositoryPath(relativePath)] : [];
  });
}

function writeRepositoryFixture(repositoryPath, fixturePath, content) {
  const filePath = resolve(repositoryPath, fixturePath);
  const relativePath = relative(repositoryPath, filePath);

  if (isAbsolute(fixturePath) || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`Fixture path must stay within the temporary repository: ${fixturePath}`);
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

describe("isForbiddenRepositoryPath", () => {
  it.each(RETAINED_PATHS)("keeps retained product surface %s present", (repositoryPath) => {
    expect(existsSync(resolve(process.cwd(), repositoryPath))).toBe(true);
  });

  it("keeps the direct F1-F6 workflows and F7 scripts defined in package.json", () => {
    const scripts = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")).scripts ?? {};

    for (const scriptName of RETAINED_WORKFLOW_SCRIPTS) {
      expect(scripts[scriptName]).toBeDefined();
    }
  });

  it("enforces English on engineering entry assets without rejecting localized product files", () => {
    expect(hasCjkText("English only")).toBe(false);
    expect(hasCjkText("中文 product copy")).toBe(true);
    expect(isEnglishEngineeringPath("README.md")).toBe(true);
    expect(isEnglishEngineeringPath("apps/vscode-extension/src/participant.ts")).toBe(false);
    expect(findEngineeringLanguageViolations(
      ["README.md", "apps/vscode-extension/src/participant.ts"],
      (repositoryPath) => repositoryPath === "README.md" ? "中文 developer guide" : "中文 localized response",
    )).toEqual(["README.md"]);
  });

  it("rejects active Feature 6 legacy report artifact references outside historical plans and specs", () => {
    expect(activeComposedReportArtifactReferences(process.cwd())).toEqual([]);
  });

  it.each([
    ".github/ISSUE_TEMPLATE/feature.yml",
    ".github/ISSUE_TEMPLATE/bug.yml",
    ".github/ISSUE_TEMPLATE/governance-change.yml",
    ".github/pull_request_template.md",
    ".github/CODEOWNERS.example",
    ".github/ci.example.yml",
    "docs/governance/development-standard.md",
    "docs/governance/github-admin-checklist.md",
  ])("includes the required collaboration asset %s", (repositoryPath) => {
    expect(existsSync(resolve(process.cwd(), repositoryPath))).toBe(true);
  });

  it("keeps the CI example outside GitHub Actions workflow discovery", () => {
    expect(existsSync(resolve(process.cwd(), ".github/workflows/ci.example.yml"))).toBe(false);
  });

  it.each([
    ".env",
    ".ENV",
    "runtime/projects/a/run.json",
    "RUNTIME/run.json",
    "sample.xls",
    "sample.xlsx",
    "sample.xlsm",
    "F8-session-output/probe.json",
    "nested/F8-session-output/probe.json",
    "F8-SESSION-OUTPUT/probe.json",
  ])(
    "rejects %s",
    (path) => expect(isForbiddenRepositoryPath(path)).toBe(true),
  );
  it.each([
    ".env.local",
    "exports/release/manifest.json",
    "EXPORTS/bundle.json",
    "sample.XLSX",
    "sample.XlS",
    "sample.XlsM",
    "a/runtime",
    "a/exports",
  ])("rejects %s", (path) => expect(isForbiddenRepositoryPath(path)).toBe(true));
  it.each([".env.example", ".ENV.EXAMPLE", "config/.env.example"])("allows Windows-equivalent environment templates at %s", (path) =>
    expect(isForbiddenRepositoryPath(path)).toBe(false),
  );
  it.each([".env.example.local", "config/.env.production"])("rejects non-template environment files at %s", (path) =>
    expect(isForbiddenRepositoryPath(path)).toBe(true),
  );
  it("allows path segments that only start with forbidden names", () => {
    expect(isForbiddenRepositoryPath("a/runtime-value/config.json")).toBe(false);
    expect(isForbiddenRepositoryPath("a/exports-value/config.json")).toBe(false);
  });
  it("allows public fixtures", () => {
    expect(isForbiddenRepositoryPath("fixtures/public/smoke-request.json")).toBe(false);
  });
  it.each([
    "F8-session-output-notes/probe.json",
    "nested/F8-session-output-notes/probe.json",
    "F8-session-output-example/probe.json",
  ])("allows safe neighbors at %s", (path) => expect(isForbiddenRepositoryPath(path)).toBe(false));
  it.each([
    "fixtures/confidential/sample.json",
    "fixtures/Confidential/sample.json",
    "a/fixtures/confidential/sample.json",
  ])(
    "rejects confidential fixture path %s",
    (path) => expect(isForbiddenRepositoryPath(path)).toBe(true),
  );
  it("rejects confidential fixture paths with Windows separators", () => {
    expect(isForbiddenRepositoryPath("fixtures\\confidential\\sample.json")).toBe(true);
  });
  it("allows fixture paths with similar confidential prefixes", () => {
    expect(isForbiddenRepositoryPath("fixtures/confidential-notes/sample.json")).toBe(false);
  });

  it("provides a parseable public smoke fixture", () => {
    const fixturePath = resolve(process.cwd(), "fixtures/public/smoke-request.json");

    expect(existsSync(fixturePath)).toBe(true);
    expect(() => JSON.parse(readFileSync(fixturePath, "utf8"))).not.toThrow();
  });

  it("can be imported in an ESM process without an entry script", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "await import('./scripts/verify-repository.mjs'); console.log('module-import-ok')",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output).toBe("module-import-ok\n");
  });

  it("rejects forcibly tracked Windows case variants in an isolated Git repository", () => {
    const repositoryPath = mkdtempSync(join(tmpdir(), "verify-repository-"));
    const fixtures = [
      [".ENV", "SECRET=value\n"],
      ["RUNTIME/run.json", "{}\n"],
      ["EXPORTS/bundle.json", "{}\n"],
      ["fixtures/Confidential/sample.json", "{}\n"],
      ["F8-session-output/probe.json", "{}\n"],
      ["nested/F8-session-output/probe.json", "{}\n"],
      ["sample.XLS", "anonymous workbook placeholder\n"],
      ["sample.XLSX", "anonymous workbook placeholder\n"],
      [".ENV.EXAMPLE", "EXAMPLE=value\n"],
      ["fixtures/public/smoke-request.json", "{}\n"],
      ["fixtures/confidential-notes/sample.json", "{}\n"],
      ["F8-session-output-notes/probe.json", "{}\n"],
      ["nested/F8-session-output-notes/probe.json", "{}\n"],
    ];

    try {
      const fixturePaths = fixtures.map(([fixturePath, content]) =>
        writeRepositoryFixture(repositoryPath, fixturePath, content),
      );

      expect(fixturePaths.every((fixturePath) => existsSync(fixturePath))).toBe(true);
      execFileSync("git", ["init", "--quiet"], { cwd: repositoryPath });
      execFileSync(
        "git",
        ["add", "--force", ...fixtures.map(([fixturePath]) => fixturePath)],
        { cwd: repositoryPath },
      );

      const result = (() => {
        try {
          execFileSync(process.execPath, [resolve(process.cwd(), "scripts/verify-repository.mjs")], {
            cwd: repositoryPath,
            encoding: "utf8",
            stdio: "pipe",
          });
          return { status: 0, stderr: "" };
        } catch (error) {
          return { status: error.status, stderr: error.stderr };
        }
      })();

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Forbidden tracked paths:");
      expect(result.stderr).toContain(".ENV");
      expect(result.stderr).toContain("RUNTIME/run.json");
      expect(result.stderr).toContain("EXPORTS/bundle.json");
      expect(result.stderr).toContain("fixtures/Confidential/sample.json");
      expect(result.stderr).toContain("F8-session-output/probe.json");
      expect(result.stderr).toContain("nested/F8-session-output/probe.json");
      expect(result.stderr).toContain("sample.XLS");
      expect(result.stderr).toContain("sample.XLSX");
      expect(result.stderr).not.toContain(".ENV.EXAMPLE");
      expect(result.stderr).not.toContain("fixtures/public/smoke-request.json");
      expect(result.stderr).not.toContain("fixtures/confidential-notes/sample.json");
      expect(result.stderr).not.toContain("F8-session-output-notes/probe.json");
    } finally {
      rmSync(repositoryPath, { force: true, recursive: true });
    }
  });
});