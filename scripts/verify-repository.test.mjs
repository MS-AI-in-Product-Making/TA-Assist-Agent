import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { isForbiddenRepositoryPath } from "./verify-repository.mjs";

describe("isForbiddenRepositoryPath", () => {
  it.each([".env", ".ENV", "runtime/projects/a/run.json", "RUNTIME/run.json", "sample.xlsx", "sample.xlsm"])(
    "rejects %s",
    (path) => expect(isForbiddenRepositoryPath(path)).toBe(true),
  );
  it.each([
    ".env.local",
    "exports/release/manifest.json",
    "EXPORTS/bundle.json",
    "sample.XLSX",
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
    const environmentPath = join(repositoryPath, ".ENV");
    const runtimePath = join(repositoryPath, "RUNTIME", "run.json");
    const exportsPath = join(repositoryPath, "EXPORTS", "bundle.json");
    const confidentialFixturePath = join(repositoryPath, "fixtures", "Confidential", "sample.json");
    const workbookPath = join(repositoryPath, "sample.XLSX");
    const environmentTemplatePath = join(repositoryPath, ".ENV.EXAMPLE");
    const publicFixturePath = join(repositoryPath, "fixtures", "public", "smoke-request.json");
    const confidentialNotesFixturePath = join(repositoryPath, "fixtures", "confidential-notes", "sample.json");

    try {
      mkdirSync(resolve(runtimePath, ".."), { recursive: true });
      mkdirSync(resolve(exportsPath, ".."), { recursive: true });
      mkdirSync(resolve(confidentialFixturePath, ".."), { recursive: true });
      mkdirSync(resolve(publicFixturePath, ".."), { recursive: true });
      mkdirSync(resolve(confidentialNotesFixturePath, ".."), { recursive: true });
      writeFileSync(environmentPath, "SECRET=value\n");
      writeFileSync(runtimePath, "{}\n");
      writeFileSync(exportsPath, "{}\n");
      writeFileSync(confidentialFixturePath, "{}\n");
      writeFileSync(workbookPath, "anonymous workbook placeholder\n");
      writeFileSync(environmentTemplatePath, "EXAMPLE=value\n");
      writeFileSync(publicFixturePath, "{}\n");
      writeFileSync(confidentialNotesFixturePath, "{}\n");
      execFileSync("git", ["init", "--quiet"], { cwd: repositoryPath });
      execFileSync(
        "git",
        [
          "add",
          "--force",
          ".ENV",
          "RUNTIME/run.json",
          "EXPORTS/bundle.json",
          "fixtures/Confidential/sample.json",
          "sample.XLSX",
          ".ENV.EXAMPLE",
          "fixtures/public/smoke-request.json",
          "fixtures/confidential-notes/sample.json",
        ],
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
      expect(result.stderr).toContain("sample.XLSX");
      expect(result.stderr).not.toContain(".ENV.EXAMPLE");
      expect(result.stderr).not.toContain("fixtures/public/smoke-request.json");
      expect(result.stderr).not.toContain("fixtures/confidential-notes/sample.json");
    } finally {
      rmSync(repositoryPath, { force: true, recursive: true });
    }
  });
});