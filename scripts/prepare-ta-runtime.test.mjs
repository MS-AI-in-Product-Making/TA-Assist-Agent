import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const bootstrapScript = path.join(repositoryRoot, "scripts", "prepare-ta-runtime.mjs");
const tempRoots = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createCleanFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ta-runtime-bootstrap-"));
  tempRoots.push(root);

  writeFileSync(path.join(root, "package.json"), `${JSON.stringify({
    name: "ta-runtime-bootstrap-fixture",
    version: "1.0.0",
    private: true,
    scripts: {
      build: "node build-fixture.mjs",
      postinstall: "node install-fixture.mjs",
    },
  }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(root, "package-lock.json"), `${JSON.stringify({
    name: "ta-runtime-bootstrap-fixture",
    version: "1.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "ta-runtime-bootstrap-fixture",
        version: "1.0.0",
      },
    },
  }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(root, "install-fixture.mjs"), [
    'import { mkdirSync, readFileSync, writeFileSync } from "node:fs";',
    'import path from "node:path";',
    'const countPath = path.join(process.cwd(), "install-count.txt");',
    'const count = Number.parseInt(readFileSync(countPath, "utf8"), 10);',
    'writeFileSync(countPath, String(count + 1), "utf8");',
    'mkdirSync(path.join(process.cwd(), "node_modules", "typescript", "bin"), { recursive: true });',
    'writeFileSync(path.join(process.cwd(), "node_modules", ".fixture-ready"), "ready\\n", "utf8");',
    'writeFileSync(path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc"), "ready\\n", "utf8");',
    "",
  ].join("\n"), "utf8");
  writeFileSync(path.join(root, "build-fixture.mjs"), [
    'import { mkdirSync, readFileSync, writeFileSync } from "node:fs";',
    'import path from "node:path";',
    'const countPath = path.join(process.cwd(), "build-count.txt");',
    'const count = Number.parseInt(readFileSync(countPath, "utf8"), 10);',
    'writeFileSync(countPath, String(count + 1), "utf8");',
    'for (const output of ["packages/contracts/dist/index.js", "packages/workbook-catalog/dist/index.js", "packages/workflow-runners/dist/index.js"]) {',
    '  const outputPath = path.join(process.cwd(), output);',
    '  mkdirSync(path.dirname(outputPath), { recursive: true });',
    '  const source = output.includes("workflow-runners") ? "export function validateF0Capabilities() {}\\n" : "export {};\\n";',
    '  writeFileSync(outputPath, source, "utf8");',
    '}',
    "",
  ].join("\n"), "utf8");
  writeFileSync(path.join(root, "install-count.txt"), "0", "utf8");
  writeFileSync(path.join(root, "build-count.txt"), "0", "utf8");
  return root;
}

function runBootstrap(root) {
  return spawnSync(process.execPath, [bootstrapScript, "--root", root], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

describe("TA runtime preparation", () => {
  it("rebuilds when a runtime entry exists but a transitive module is missing", () => {
    const root = createCleanFixture();
    expect(runBootstrap(root).status).toBe(0);
    writeFileSync(
      path.join(root, "packages", "workflow-runners", "dist", "index.js"),
      'export { missingRuntimeModule } from "./missing-runtime-module.js";\n',
      "utf8",
    );

    const result = runBootstrap(root);

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(path.join(root, "install-count.txt"), "utf8")).toBe("1");
    expect(readFileSync(path.join(root, "build-count.txt"), "utf8")).toBe("2");
  });

  it("repairs an incomplete dependency installation before building", () => {
    const root = createCleanFixture();
    mkdirSync(path.join(root, "node_modules"));

    const result = runBootstrap(root);

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(path.join(root, "install-count.txt"), "utf8")).toBe("1");
    expect(readFileSync(path.join(root, "build-count.txt"), "utf8")).toBe("1");
  });

  it("installs and builds a clean checkout once, then reuses the prepared runtime", () => {
    const root = createCleanFixture();

    const firstRun = runBootstrap(root);

    expect(firstRun.status, firstRun.stderr).toBe(0);
    expect(existsSync(path.join(root, "node_modules"))).toBe(true);
    expect(readFileSync(path.join(root, "install-count.txt"), "utf8")).toBe("1");
    expect(existsSync(path.join(root, "packages", "workflow-runners", "dist", "index.js"))).toBe(true);
    expect(readFileSync(path.join(root, "build-count.txt"), "utf8")).toBe("1");

    const secondRun = runBootstrap(root);

    expect(secondRun.status, secondRun.stderr).toBe(0);
    expect(readFileSync(path.join(root, "install-count.txt"), "utf8")).toBe("1");
    expect(readFileSync(path.join(root, "build-count.txt"), "utf8")).toBe("1");
  });
});