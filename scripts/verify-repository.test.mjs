import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { isForbiddenRepositoryPath } from "./verify-repository.mjs";

describe("isForbiddenRepositoryPath", () => {
  it.each([".env", "runtime/projects/a/run.json", "sample.xlsx", "sample.xlsm"])(
    "rejects %s",
    (path) => expect(isForbiddenRepositoryPath(path)).toBe(true),
  );
  it.each([
    ".env.local",
    "exports/release/manifest.json",
    "sample.XLSX",
    "sample.XlsM",
    "a/runtime",
    "a/exports",
  ])("rejects %s", (path) => expect(isForbiddenRepositoryPath(path)).toBe(true));
  it.each([".env.example", "config/.env.example"])("allows environment templates at %s", (path) =>
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
});