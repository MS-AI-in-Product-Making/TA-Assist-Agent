import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const root = process.cwd();
const packageSourceExports = {
  "packages/contracts/package.json": {
    ".": "./src/index.ts",
  },
  "packages/f7-statistics/package.json": {
    ".": "./src/index.ts",
    "./capability": "./src/capability.ts",
    "./factor-measured-comparison": "./src/factor-measured-comparison.ts",
    "./measurement-diagnostics": "./src/measurement-diagnostics.ts",
    "./measurement-observation": "./src/measurement-observation.ts",
    "./measurement-structure": "./src/measurement-structure.ts",
    "./measurement-warnings": "./src/measurement-warnings.ts",
  },
  "packages/f7-simulation/package.json": {
    ".": "./src/index.ts",
  },
  "packages/knowledge-base/package.json": {
    ".": "./src/index.ts",
    "./process-requirements": "./src/process-requirements/query.ts",
    "./public-engineering-rules": "./src/public-engineering-rules.ts",
    "./public-distribution-rules": "./src/public-distribution-rules.ts",
    "./interpretation-rules": "./src/interpretation-rules.ts",
  },
  "packages/product-language/package.json": {
    ".": "./src/index.ts",
    "./f7-engineering-narrative": "./src/f7-engineering-narrative.ts",
    "./ta-workbook-language": "./src/ta-workbook-language.ts",
    "./input-metadata": "./src/input-metadata.ts",
  },
  "packages/workbook-catalog/package.json": {
    ".": "./src/index.ts",
    "./calculation-kernel": "./src/calculation-kernel.ts",
  },
};

const packageSpecifiers = {
  "@ai-assist/contracts": "packages/contracts/src/index.ts",
  "@ai-assist/f7-statistics": "packages/f7-statistics/src/index.ts",
  "@ai-assist/f7-statistics/capability": "packages/f7-statistics/src/capability.ts",
  "@ai-assist/f7-statistics/factor-measured-comparison": "packages/f7-statistics/src/factor-measured-comparison.ts",
  "@ai-assist/f7-statistics/measurement-diagnostics": "packages/f7-statistics/src/measurement-diagnostics.ts",
  "@ai-assist/f7-statistics/measurement-observation": "packages/f7-statistics/src/measurement-observation.ts",
  "@ai-assist/f7-statistics/measurement-structure": "packages/f7-statistics/src/measurement-structure.ts",
  "@ai-assist/f7-statistics/measurement-warnings": "packages/f7-statistics/src/measurement-warnings.ts",
  "@ai-assist/f7-simulation": "packages/f7-simulation/src/index.ts",
  "@ai-assist/knowledge-base": "packages/knowledge-base/src/index.ts",
  "@ai-assist/knowledge-base/process-requirements": "packages/knowledge-base/src/process-requirements/query.ts",
  "@ai-assist/knowledge-base/public-engineering-rules": "packages/knowledge-base/src/public-engineering-rules.ts",
  "@ai-assist/knowledge-base/public-distribution-rules": "packages/knowledge-base/src/public-distribution-rules.ts",
  "@ai-assist/knowledge-base/interpretation-rules": "packages/knowledge-base/src/interpretation-rules.ts",
  "@ai-assist/product-language": "packages/product-language/src/index.ts",
  "@ai-assist/product-language/f7-engineering-narrative": "packages/product-language/src/f7-engineering-narrative.ts",
  "@ai-assist/product-language/ta-workbook-language": "packages/product-language/src/ta-workbook-language.ts",
  "@ai-assist/product-language/input-metadata": "packages/product-language/src/input-metadata.ts",
  "@ai-assist/workbook-catalog": "packages/workbook-catalog/src/index.ts",
  "@ai-assist/workbook-catalog/calculation-kernel": "packages/workbook-catalog/src/calculation-kernel.ts",
};

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function resolvePackage(specifier, conditions = []) {
  const output = execFileSync(process.execPath, [
    ...conditions.flatMap((condition) => ["--conditions", condition]),
    "--input-type=module",
    "--eval",
    `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
  ], { cwd: root, encoding: "utf8" }).trim();

  return decodeURIComponent(new URL(output).pathname).replace(/^\/[A-Za-z]:\//, "").replaceAll("\\", "/");
}

test("F7 development resolves workspace packages from source without changing production imports", () => {
  for (const [packagePath, exports] of Object.entries(packageSourceExports)) {
    const manifest = readJson(packagePath);
    for (const [exportName, sourceTarget] of Object.entries(exports)) {
      expect(manifest.exports[exportName].source, `${packagePath} ${exportName}`).toBe(sourceTarget);
      expect(manifest.exports[exportName].import).toMatch(/^\.\/dist\/.+\.js$/);
      expect(existsSync(path.resolve(path.dirname(path.join(root, packagePath)), sourceTarget))).toBe(true);
    }
  }

  const apiPackage = readJson("apps/f7-local-api/package.json");
  expect(apiPackage.scripts.dev).toBe("node --conditions=source --import tsx --watch src/main.ts");

  const viteConfig = readFileSync(path.join(root, "apps/f7-web/vite.config.ts"), "utf8");
  expect(viteConfig).toMatch(/defineConfig\(\(\{ command \}\) =>/);
  expect(viteConfig).toMatch(/command === "serve" \? \{ resolve: \{ conditions: \["source"\] \} \} : \{\}/);

  for (const [specifier, sourcePath] of Object.entries(packageSpecifiers)) {
    expect(resolvePackage(specifier, ["source"])).toMatch(new RegExp(`${sourcePath.replaceAll("/", "\\/")}$`));
    expect(resolvePackage(specifier)).toMatch(/\/dist\/.+\.js$/);
  }
});

test("generated dist exceptions are not tracked", () => {
  const generatedPaths = [
    "packages/contracts/dist/f7-contracts.d.ts",
    "packages/workbench/dist/state-machine.js",
  ];
  const tracked = execFileSync("git", ["ls-files", ...generatedPaths], { cwd: root, encoding: "utf8" }).trim();

  expect(tracked).toBe("");
  for (const generatedPath of generatedPaths) {
    expect(() => execFileSync("git", ["check-ignore", "--quiet", "--no-index", generatedPath], { cwd: root })).not.toThrow();
  }
});
