import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const workspaceRoot = join(import.meta.dirname, "..", "..", "..");
const packageRoot = join(workspaceRoot, "apps", "workbench-server");
const serverAssetRoot = join(packageRoot, "assets", "workbench");
const webDistRoot = join(workspaceRoot, "apps", "workbench-web", "dist");
const npmCliPath = process.env.npm_execpath;

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function parsePackJson(stdout: string): Array<{ filename: string; files: Array<{ path: string }> }> {
  const jsonStart = stdout.lastIndexOf("[\n  {");
  expect(jsonStart).toBeGreaterThanOrEqual(0);
  return JSON.parse(stdout.slice(jsonStart)) as Array<{ filename: string; files: Array<{ path: string }> }>;
}

describe("workbench-server package release assets", () => {
  it("rebuilds deterministic workbench assets before npm pack includes them", { timeout: 120_000 }, async () => {
    expect(npmCliPath).toBeDefined();
    const packDestination = join(workspaceRoot, ".tmp", `workbench-server-pack-${randomUUID()}`);
    const extractRoot = join(packDestination, "extract");
    const scriptAssetPath = join(serverAssetRoot, "workbench.js");
    const stylesheetAssetPath = join(serverAssetRoot, "workbench.css");
    const [originalScriptAsset, originalStylesheetAsset] = await Promise.all([readFile(scriptAssetPath), readFile(stylesheetAssetPath)]);

    await mkdir(packDestination, { recursive: true });
    await writeFile(scriptAssetPath, "// stale marker that must not be packed\n");
    try {
      const { stdout } = await execFileAsync(process.execPath, [npmCliPath ?? "", "pack", "--workspace", "@ai-assist/workbench-server", "--pack-destination", packDestination, "--json"], { cwd: workspaceRoot });
      const [packResult] = parsePackJson(stdout);
      expect(packResult.files.map((file) => file.path)).toEqual(expect.arrayContaining(["assets/workbench/workbench.js", "assets/workbench/workbench.css"]));

      await mkdir(extractRoot, { recursive: true });
      await execFileAsync("tar", ["-xf", join(packDestination, packResult.filename), "-C", extractRoot]);

      expect(await readFile(join(extractRoot, "package", "assets", "workbench", "workbench.js"), "utf8")).not.toContain("stale marker");
      expect(await sha256(join(extractRoot, "package", "assets", "workbench", "workbench.js"))).toBe(await sha256(join(webDistRoot, "workbench.js")));
      expect(await sha256(join(extractRoot, "package", "assets", "workbench", "workbench.css"))).toBe(await sha256(join(webDistRoot, "workbench.css")));
    } finally {
      await Promise.all([writeFile(scriptAssetPath, originalScriptAsset), writeFile(stylesheetAssetPath, originalStylesheetAsset)]);
      await rm(packDestination, { recursive: true, force: true });
    }
  });
});