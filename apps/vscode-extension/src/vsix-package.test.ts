import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const VSIX_PATH = resolve("apps/vscode-extension/dist/ta-assist-workbook-analysis-beta.vsix");
const WORKSPACE_ROOT = resolve(".");

type PackageRunArtifacts = {
  beforeStatus: string;
  afterStatus: string;
  entries: string[];
  extractDir: string;
};

let artifacts: PackageRunArtifacts;

describe("vsix package", () => {
  beforeAll(async () => {
    artifacts = await runPackageAndCollectArtifacts();
  }, 60_000);

  afterAll(async () => {
    if (artifacts === undefined) return;
    await rm(artifacts.extractDir, { recursive: true, force: true });
  });

  it("produces a standard VSIX metadata layout", async () => {
    await access(VSIX_PATH);
    const entries = artifacts.entries;

    expect(entries).toEqual(expect.arrayContaining([
      "[Content_Types].xml",
      "extension.vsixmanifest",
      "extension/package.json",
    ]));
  });

  it("boots bundled runtime CLI with deterministic smoke command", async () => {
    const runtimeEntry = resolve(artifacts.extractDir, "extension", "runtime", "cli", "index.cjs");
    const { stdout, stderr } = await execFileAsync(process.execPath, [runtimeEntry, "--help"], { windowsHide: true });
    const output = `${stdout}\n${stderr}`;

    expect(output).not.toMatch(/Dynamic require of\s+"node:[^"]+"\s+is not supported/ui);
    expect(output).not.toMatch(/Cannot find module|MODULE_NOT_FOUND/ui);
  }, 20_000);

  it("does not ship test artifacts or dev payload", async () => {
    const entries = artifacts.entries;

    expect(entries).toEqual(expect.arrayContaining([
      "extension/dist/extension.js",
      "extension/runtime/cli/index.cjs",
      "extension/runtime/workbench/workbench.js",
      "extension/runtime/workbench/workbench.css",
      "extension/runtime/assets/workbench/workbench.js",
      "extension/runtime/assets/workbench/workbench.css",
    ]));
    expect(entries.some((entry) => /\.test\.(?:js|ts|d\.ts|js\.map)$/ui.test(entry))).toBe(false);
    expect(entries.some((entry) => /\.map$/ui.test(entry))).toBe(false);
    expect(entries.some((entry) => entry.startsWith("extension/runtime/node_modules/"))).toBe(false);
    expect(entries.some((entry) => /extension\/runtime\/.*(?:vitest|playwright|eslint|typescript|tsx|@types)\b/i.test(entry))).toBe(false);
    expect(entries.some((entry) => /(^|\/)fixtures\//ui.test(entry))).toBe(false);
    expect(entries.some((entry) => /(^|\/)uploads\//ui.test(entry))).toBe(false);
    expect(entries.some((entry) => entry.includes("test/demo-output"))).toBe(false);
  });

  it("keeps tracked tree unchanged after packaging", async () => {
    expect(artifacts.afterStatus).toBe(artifacts.beforeStatus);
  });
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

async function runPackageAndCollectArtifacts(): Promise<PackageRunArtifacts> {
  const beforeStatus = await trackedStatus();
  await execFileAsync(process.execPath, [resolve("apps/vscode-extension/scripts/package-vsix.mjs")], { cwd: WORKSPACE_ROOT, windowsHide: true });
  const afterStatus = await trackedStatus();
  const entries = await listVsixEntries(VSIX_PATH);

  const extractDir = await mkdtemp(resolve(tmpdir(), "ta-assist-vsix-"));
  await extractVsix(VSIX_PATH, extractDir);
  return { beforeStatus, afterStatus, entries, extractDir };
}

async function trackedStatus(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["status", "--short"], { cwd: WORKSPACE_ROOT, windowsHide: true });
  return stdout
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .filter((line) => !line.startsWith("?? "))
    .join("\n");
}

async function extractVsix(vsixPath: string, destination: string): Promise<void> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `Expand-Archive -LiteralPath '${vsixPath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`,
  ].join("; ");
  await execFileAsync("pwsh", ["-NoProfile", "-Command", script], { windowsHide: true });
  await readFile(resolve(destination, "extension", "package.json"), "utf8");
}