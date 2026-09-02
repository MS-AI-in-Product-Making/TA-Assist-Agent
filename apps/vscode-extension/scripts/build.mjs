import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { builtinModules, createRequire } from "node:module";

const execFileAsync = promisify(execFile);
const extensionRoot = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const workspaceRoot = resolve(extensionRoot, "..", "..");
const runtimeRoot = join(extensionRoot, "runtime");
const extensionDistRoot = join(extensionRoot, "dist");
const require = createRequire(import.meta.url);
const tscCli = require.resolve("typescript/bin/tsc");
const { build } = await import("esbuild");

await runNode([tscCli, "-b"], workspaceRoot);

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(runtimeRoot, { recursive: true });
await mkdir(join(runtimeRoot, "cli"), { recursive: true });
await mkdir(join(runtimeRoot, "workbench"), { recursive: true });
await mkdir(join(runtimeRoot, "assets", "workbench"), { recursive: true });
await mkdir(extensionDistRoot, { recursive: true });

await build({
  entryPoints: [join(extensionRoot, "src", "extension.ts")],
  outfile: join(extensionDistRoot, "extension.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  minify: false,
  external: runtimeExternalModules(),
});

await build({
  entryPoints: [join(workspaceRoot, "apps", "cli", "dist", "index.js")],
  outfile: join(runtimeRoot, "cli", "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  minify: false,
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  external: runtimeExternalModules(),
});

await writeFile(join(runtimeRoot, "cli", "index.cjs"), [
  "#!/usr/bin/env node",
  "const { pathToFileURL } = require('node:url');",
  "const { join } = require('node:path');",
  "(async () => {",
  "  const cli = await import(pathToFileURL(join(__dirname, 'index.mjs')).href);",
  "  const result = await cli.executeCli(process.argv.slice(2));",
  "  process.stdout.write(result.stdout);",
  "  process.stderr.write(result.stderr);",
  "  process.exitCode = result.exitCode;",
  "})().catch((error) => {",
  "  console.error(error);",
  "  process.exitCode = 1;",
  "});",
  "",
].join("\n"), "utf8");

await cp(join(workspaceRoot, "apps", "workbench-server", "assets", "workbench", "workbench.js"), join(runtimeRoot, "workbench", "workbench.js"), { force: true });
await cp(join(workspaceRoot, "apps", "workbench-server", "assets", "workbench", "workbench.css"), join(runtimeRoot, "workbench", "workbench.css"), { force: true });
await cp(join(workspaceRoot, "apps", "workbench-server", "assets", "workbench", "workbench.js"), join(runtimeRoot, "assets", "workbench", "workbench.js"), { force: true });
await cp(join(workspaceRoot, "apps", "workbench-server", "assets", "workbench", "workbench.css"), join(runtimeRoot, "assets", "workbench", "workbench.css"), { force: true });

async function runNode(args, cwd) {
  await execFileAsync(process.execPath, args, { cwd, windowsHide: true });
}

function runtimeExternalModules() {
  const names = new Set(["vscode"]);
  for (const moduleName of builtinModules) {
    names.add(moduleName);
    names.add(moduleName.startsWith("node:") ? moduleName.slice(5) : `node:${moduleName}`);
  }
  return [...names];
}