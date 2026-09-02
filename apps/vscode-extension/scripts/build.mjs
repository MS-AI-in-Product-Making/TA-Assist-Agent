import { cp, mkdir, rm } from "node:fs/promises";
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { builtinModules, createRequire } from "node:module";

const execFileAsync = promisify(execFile);
const extensionRoot = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const workspaceRoot = resolve(extensionRoot, "..", "..");
const runtimeRoot = join(extensionRoot, "runtime");
const require = createRequire(import.meta.url);
const tscCli = require.resolve("typescript/bin/tsc");
const npmCli = await resolveNpmCli();
const { build } = await import("esbuild");

await runNode([tscCli, "-b", "--force"], workspaceRoot);
await runNode([npmCli, "--workspace", "@ai-assist/workbench-server", "run", "build"], workspaceRoot);

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(runtimeRoot, { recursive: true });
await mkdir(join(runtimeRoot, "cli"), { recursive: true });
await mkdir(join(runtimeRoot, "workbench"), { recursive: true });
await mkdir(join(runtimeRoot, "assets", "workbench"), { recursive: true });

await build({
  entryPoints: [join(workspaceRoot, "apps", "cli", "dist", "index.js")],
  outfile: join(runtimeRoot, "cli", "index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  minify: false,
  external: runtimeExternalModules(),
});

await cp(join(workspaceRoot, "apps", "workbench-server", "assets", "workbench", "workbench.js"), join(runtimeRoot, "workbench", "workbench.js"), { force: true });
await cp(join(workspaceRoot, "apps", "workbench-server", "assets", "workbench", "workbench.css"), join(runtimeRoot, "workbench", "workbench.css"), { force: true });
await cp(join(workspaceRoot, "apps", "workbench-server", "assets", "workbench", "workbench.js"), join(runtimeRoot, "assets", "workbench", "workbench.js"), { force: true });
await cp(join(workspaceRoot, "apps", "workbench-server", "assets", "workbench", "workbench.css"), join(runtimeRoot, "assets", "workbench", "workbench.css"), { force: true });

async function runNode(args, cwd) {
  await execFileAsync(process.execPath, args, { cwd, windowsHide: true });
}

async function resolveNpmCli() {
  const candidates = [];
  if (typeof process.env.npm_execpath === "string" && process.env.npm_execpath.length > 0) {
    candidates.push(process.env.npm_execpath);
  }
  candidates.push(join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Unable to locate npm CLI script for workspace build.");
}

function runtimeExternalModules() {
  const names = new Set(["vscode"]);
  for (const moduleName of builtinModules) {
    names.add(moduleName);
    names.add(moduleName.startsWith("node:") ? moduleName.slice(5) : `node:${moduleName}`);
  }
  return [...names];
}