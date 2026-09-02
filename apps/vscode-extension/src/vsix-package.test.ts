import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const VSIX_PATH = resolve("apps/vscode-extension/dist/ta-assist-workbook-analysis-beta.vsix");

describe("vsix package", () => {
  it("packages a self-contained TA Assist Beta extension", async () => {
    await execFileAsync(process.execPath, [resolve("apps/vscode-extension/scripts/package-vsix.mjs")], { cwd: resolve("."), windowsHide: true });
    await access(VSIX_PATH);
    const entries = await listVsixEntries(VSIX_PATH);

    expect(entries).toEqual(expect.arrayContaining([
      "extension/dist/extension.js",
      "extension/runtime/cli/index.js",
      "extension/runtime/workbench/workbench.js",
      "extension/runtime/workbench/workbench.css",
      "extension/runtime/assets/workbench/workbench.js",
      "extension/runtime/assets/workbench/workbench.css",
    ]));
    expect(entries.some((entry) => entry.startsWith("extension/runtime/node_modules/"))).toBe(false);
    expect(entries.some((entry) => /extension\/runtime\/.*(?:vitest|playwright|eslint|typescript|tsx|@types)\b/i.test(entry))).toBe(false);
    expect(entries.some((entry) => entry.includes("test/demo-output"))).toBe(false);
  }, 60_000);
});

async function listVsixEntries(vsixPath: string): Promise<string[]> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$zip = [System.IO.Compression.ZipFile]::OpenRead('${vsixPath.replace(/'/g, "''")}')`,
    "try {",
    "  $zip.Entries | ForEach-Object { $_.FullName }",
    "} finally {",
    "  $zip.Dispose()",
    "}",
  ].join("; ");
  const { stdout } = await execFileAsync("pwsh", ["-NoProfile", "-Command", script], { windowsHide: true });
  return stdout.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.length > 0);
}