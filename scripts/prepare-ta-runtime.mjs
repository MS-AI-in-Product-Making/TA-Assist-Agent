import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const requiredRuntimeFiles = [
  "packages/contracts/dist/index.js",
  "packages/workbook-catalog/dist/index.js",
  "packages/workflow-runners/dist/index.js",
];

function parseRoot(args) {
  if (args.length === 0) return process.cwd();
  if (args.length === 2 && args[0] === "--root") return path.resolve(args[1]);
  throw new Error("Usage: node scripts/prepare-ta-runtime.mjs [--root <repository-root>]");
}

function runNpm(root, args, stage) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    shell: !npmCli && process.platform === "win32",
  });

  if (result.error) throw new Error(`${stage} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${stage} failed with exit code ${result.status}.`);
}

function inspectRuntime(root) {
  const missingRuntimeFiles = requiredRuntimeFiles.filter((relativePath) => !existsSync(path.join(root, relativePath)));
  if (missingRuntimeFiles.length > 0) return { ready: false, missingRuntimeFiles, diagnostic: "" };

  const workflowRunnerUrl = pathToFileURL(path.join(root, "packages", "workflow-runners", "dist", "index.js")).href;
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    `const runtime = await import(${JSON.stringify(workflowRunnerUrl)}); if (typeof runtime.validateF0Capabilities !== "function") throw new Error("validateF0Capabilities export is unavailable");`,
  ], {
    cwd: root,
    encoding: "utf8",
  });
  const diagnostic = [result.stderr, result.stdout, result.error?.message].filter(Boolean).join("\n").trim();
  return { ready: result.status === 0 && !result.error, missingRuntimeFiles: [], diagnostic };
}

export function prepareTaRuntime(root) {
  const packageJsonPath = path.join(root, "package.json");
  const packageLockPath = path.join(root, "package-lock.json");
  if (!existsSync(packageJsonPath) || !existsSync(packageLockPath)) {
    throw new Error("TA runtime preparation requires package.json and package-lock.json at the repository root.");
  }

  if (!existsSync(path.join(root, "node_modules", "typescript", "bin", "tsc"))) {
    process.stdout.write("Preparing TA Assist Agent dependencies...\n");
    runNpm(root, ["ci"], "Dependency installation");
  }

  const initialRuntime = inspectRuntime(root);
  if (!initialRuntime.ready) {
    process.stdout.write("Building TA Assist Agent runtime...\n");
    runNpm(root, ["run", "build", "--", "--force"], "Runtime build");
  }

  const preparedRuntime = inspectRuntime(root);
  if (!preparedRuntime.ready) {
    const detail = preparedRuntime.missingRuntimeFiles.length > 0
      ? `missing outputs: ${preparedRuntime.missingRuntimeFiles.join(", ")}`
      : `runtime import check failed: ${preparedRuntime.diagnostic || "unknown import error"}`;
    throw new Error(`Runtime build completed without a usable governed entry (${detail}).`);
  }

  process.stdout.write("TA Assist Agent runtime is ready.\n");
}

try {
  prepareTaRuntime(parseRoot(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(`TA runtime preparation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}