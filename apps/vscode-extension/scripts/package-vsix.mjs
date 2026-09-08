import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const execFileAsync = promisify(execFile);
const extensionRoot = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const workspaceRoot = resolve(extensionRoot, "..", "..");
const vsixOutDir = join(extensionRoot, "dist");
const vsixPath = join(vsixOutDir, "ta-assist-workbook-analysis-beta.vsix");
const targetPlatform = `${process.platform}-${process.arch}`;
const require = createRequire(import.meta.url);
const vsceCli = require.resolve("@vscode/vsce/vsce");

await execFileAsync(process.execPath, [join(extensionRoot, "scripts", "build.mjs")], { cwd: workspaceRoot, windowsHide: true });

await mkdir(vsixOutDir, { recursive: true });
await rm(vsixPath, { force: true });

await execFileAsync(process.execPath, [vsceCli, "package", "--target", targetPlatform, "--no-dependencies", "--allow-missing-repository", "--out", vsixPath], {
  cwd: extensionRoot,
  windowsHide: true,
});

process.stdout.write(`${vsixPath}\n`);