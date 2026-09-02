import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const extensionRoot = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const workspaceRoot = resolve(extensionRoot, "..", "..");
const stagingRoot = join(extensionRoot, ".tmp", "vsix-staging");
const vsixOutDir = join(extensionRoot, "dist");
const vsixPath = join(vsixOutDir, "ta-assist-workbook-analysis-beta.vsix");

await execFileAsync(process.execPath, [join(extensionRoot, "scripts", "build.mjs")], { cwd: workspaceRoot, windowsHide: true });

await rm(stagingRoot, { recursive: true, force: true });
await mkdir(join(stagingRoot, "extension"), { recursive: true });
await mkdir(vsixOutDir, { recursive: true });
await rm(vsixPath, { force: true });

await cp(join(extensionRoot, "package.json"), join(stagingRoot, "extension", "package.json"), { force: true });
await cp(join(extensionRoot, "dist"), join(stagingRoot, "extension", "dist"), { recursive: true, force: true });
await cp(join(extensionRoot, "runtime"), join(stagingRoot, "extension", "runtime"), { recursive: true, force: true });

const script = [
  "$ErrorActionPreference = 'Stop'",
  `Compress-Archive -Path '${join(stagingRoot, "extension").replace(/'/g, "''")}' -DestinationPath '${vsixPath.replace(/'/g, "''")}' -CompressionLevel Optimal -Force`,
].join("; ");
await execFileAsync("pwsh", ["-NoProfile", "-Command", script], { windowsHide: true });

process.stdout.write(`${vsixPath}\n`);