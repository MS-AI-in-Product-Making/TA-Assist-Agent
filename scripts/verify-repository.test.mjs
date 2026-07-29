import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { isForbiddenRepositoryPath } from "./verify-repository.mjs";

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

  it.each([".env", ".ENV", "runtime/projects/a/run.json", "RUNTIME/run.json", "sample.xls", "sample.xlsx", "sample.xlsm"])(
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
      ["sample.XLS", "anonymous workbook placeholder\n"],
      ["sample.XLSX", "anonymous workbook placeholder\n"],
      [".ENV.EXAMPLE", "EXAMPLE=value\n"],
      ["fixtures/public/smoke-request.json", "{}\n"],
      ["fixtures/confidential-notes/sample.json", "{}\n"],
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
      expect(result.stderr).toContain("sample.XLS");
      expect(result.stderr).toContain("sample.XLSX");
      expect(result.stderr).not.toContain(".ENV.EXAMPLE");
      expect(result.stderr).not.toContain("fixtures/public/smoke-request.json");
      expect(result.stderr).not.toContain("fixtures/confidential-notes/sample.json");
    } finally {
      rmSync(repositoryPath, { force: true, recursive: true });
    }
  });
});