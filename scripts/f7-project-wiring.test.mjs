import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = path.resolve(import.meta.dirname, "..");

function readJson(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw);
}

describe("f7 project wiring", () => {
  it("wires root scripts, workspaces, and test config", async () => {
    const rootPackage = readJson("package.json");
    const scripts = rootPackage.scripts ?? {};

    expect(scripts["dev:f7"]).toContain("concurrently");
    expect(scripts["dev:f7"]).toContain("dev:f7:api");
    expect(scripts["dev:f7"]).toContain("dev:f7:web");
    expect(scripts["build:f7:web"]).toBeDefined();
    expect(scripts["dev:f7:api"]).toBe("npm run dev --workspace @ai-assist/f7-local-api");

    expect(scripts.test).toBe("npm run build -- --force && vitest run");
    expect(scripts.test).not.toContain("--workspace");

    const apiPackage = readJson("apps/f7-local-api/package.json");
    expect(apiPackage.name).toBe("@ai-assist/f7-local-api");
    expect(apiPackage.scripts?.dev).toBe("tsx watch src/main.ts");

    const apiIndexPath = path.join(rootDir, "apps/f7-local-api/src/index.ts");
    const apiMainPath = path.join(rootDir, "apps/f7-local-api/src/main.ts");
    expect(fs.existsSync(apiIndexPath)).toBe(true);
    expect(fs.existsSync(apiMainPath)).toBe(true);

    const webPackage = readJson("apps/f7-web/package.json");
    expect(webPackage.name).toBe("@ai-assist/f7-web");

    const webHostPath = path.join(rootDir, "apps/f7-web/index.html");
    expect(fs.existsSync(webHostPath)).toBe(true);
    const webHostContent = fs.readFileSync(webHostPath, "utf-8");
    expect(webHostContent).toContain('<div id="app"></div>');
    expect(webHostContent).toContain("src/main.ts");
    expect(webHostContent).toContain('type="module"');

    const rootTsconfig = readJson("tsconfig.json");
    const references = rootTsconfig.references ?? [];
    expect(references).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "./apps/f7-local-api" })]),
    );

    const vitestConfigPath = path.join(rootDir, "vitest.config.ts");
    expect(fs.existsSync(vitestConfigPath)).toBe(true);
    const vitestConfigModule = await import(pathToFileURL(vitestConfigPath).href);
    const vitestConfig = vitestConfigModule.default;

    const projects = vitestConfig?.test?.projects;
    expect(Array.isArray(projects)).toBe(true);
    expect(projects).toHaveLength(2);

    const [nodeProject, webProject] = projects;
    expect(nodeProject?.test?.name).toBe("node");
    expect(nodeProject?.test?.testTimeout).toBe(60_000);
    expect(nodeProject?.test?.maxWorkers).toBe(4);
    expect(nodeProject?.test?.include).toEqual([
      "apps/**/*.test.ts",
      "scripts/**/*.test.mjs",
      "packages/**/*.test.ts",
    ]);
    expect(nodeProject?.test?.exclude).toEqual([
      "apps/f7-web/**/*.test.ts",
      "scripts/f4-excel-regression.test.mjs",
    ]);

    expect(webProject?.test?.name).toBe("f7-web");
    expect(webProject?.test?.include).toEqual(["apps/f7-web/**/*.test.ts"]);
    expect(webProject?.test?.environment).toBe("jsdom");
    expect(Array.isArray(webProject?.plugins)).toBe(true);
    expect(webProject?.plugins?.some((plugin) => typeof plugin === "object" && plugin !== null && typeof plugin.name === "string" && plugin.name.toLowerCase().includes("vue"))).toBe(true);

    expect(projects.some((project) => project?.test?.name === "workbench-web")).toBe(false);

    const workspaceConfigPath = path.join(rootDir, "vitest.workspace.ts");
    expect(fs.existsSync(workspaceConfigPath)).toBe(false);

    expect(rootPackage.overrides).toBeUndefined();

    const playwrightConfigPath = path.join(rootDir, "playwright.config.ts");
    const playwrightConfigModule = await import(pathToFileURL(playwrightConfigPath).href);
    const playwrightConfig = playwrightConfigModule.default;
    expect(playwrightConfig?.testDir).toBe("test/e2e");
    expect(playwrightConfig?.testMatch).toBe("**/*.spec.ts");

    const eslintConfigModule = await import(pathToFileURL(path.join(rootDir, "eslint.config.mjs")).href);
    const ignoreConfig = eslintConfigModule.default.find((entry) => Array.isArray(entry.ignores));
    expect(ignoreConfig?.ignores).toContain("**/.worktrees/**");
  });
});
