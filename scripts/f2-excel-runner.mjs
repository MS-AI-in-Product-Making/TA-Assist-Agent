import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { f2UserReportSchema } from "../packages/contracts/dist/contracts.js";
import { safeName } from "./f1-output-layout.mjs";

function defaultExecuteStage({ command, args, cwd, env }) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`Workflow stage exited with code ${result.status}: ${result.stderr || result.stdout}`.trim());
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

function errorDetails(error) {
  return { name: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message : String(error) };
}

export function runF2ExcelWorkflow({ workbookPath, repositoryRoot = process.cwd(), now = () => new Date(), executeStage = defaultExecuteStage }) {
  const root = path.resolve(repositoryRoot);
  const workbook = path.resolve(root, workbookPath);
  if (path.extname(workbook).toLowerCase() !== ".xlsx") throw new Error("Feature 2 Excel workflow requires exactly one .xlsx workbook.");
  if (!existsSync(workbook) || !statSync(workbook).isFile()) throw new Error(`Feature 2 workbook does not exist: ${workbookPath}`);

  const workbookName = safeName(path.basename(workbook, path.extname(workbook)));
  if (!workbookName) throw new Error("Feature 2 workbook output name is empty.");
  const startedAt = now().toISOString();
  const runId = startedAt.replace(/[:.]/g, "-");
  const runRoot = path.join(root, "test", "demo-output", "f2-runs", workbookName, runId);
  if (existsSync(runRoot)) throw new Error(`Feature 2 run already exists: ${runRoot}`);
  const f1Root = path.join(runRoot, "f1");
  const f2Root = path.join(runRoot, "f2");
  const validationRoot = path.join(runRoot, "validation");
  const manifestPath = path.join(runRoot, "manifest.json");
  mkdirSync(validationRoot, { recursive: true });

  const manifest = {
    contractVersion: "v1",
    runId,
    status: "running",
    workbookPath: workbook,
    repositoryRoot: root,
    runRoot,
    startedAt,
    updatedAt: startedAt,
    outputs: { f1Root, f2Root, validationRoot },
    stages: { f1: { status: "pending" }, f2: { status: "pending" }, validation: { status: "pending" } },
  };
  const persistManifest = () => {
    manifest.updatedAt = now().toISOString();
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  };
  persistManifest();

  const runStage = (stage, args, outputVariable, outputRoot) => {
    manifest.stages[stage] = { status: "running", startedAt: now().toISOString() };
    persistManifest();
    try {
      const result = executeStage({ stage, command: process.execPath, args, cwd: root, env: { ...process.env, [outputVariable]: outputRoot } }) ?? {};
      writeFileSync(path.join(validationRoot, `${stage}.stdout.log`), result.stdout ?? "", "utf8");
      writeFileSync(path.join(validationRoot, `${stage}.stderr.log`), result.stderr ?? "", "utf8");
      manifest.stages[stage] = { ...manifest.stages[stage], status: "completed", completedAt: now().toISOString() };
      persistManifest();
    } catch (error) {
      writeFileSync(path.join(validationRoot, `${stage}.stdout.log`), error?.stdout ?? "", "utf8");
      writeFileSync(path.join(validationRoot, `${stage}.stderr.log`), error?.stderr ?? errorDetails(error).message, "utf8");
      manifest.stages[stage] = { ...manifest.stages[stage], status: "failed", failedAt: now().toISOString(), error: errorDetails(error) };
      manifest.status = "failed";
      manifest.error = errorDetails(error);
      persistManifest();
      throw error;
    }
  };

  runStage("f1", ["scripts/run-f1-full-validation.mjs", workbook], "AI_TVA_F1_OUTPUT_ROOT", f1Root);
  runStage("f2", ["scripts/run-f2-full-validation.mjs", f1Root], "AI_TVA_F2_OUTPUT_ROOT", f2Root);

  manifest.stages.validation = { status: "running", startedAt: now().toISOString() };
  persistManifest();
  try {
    const reportPath = path.join(f2Root, "Feature2-Report.json");
    const report = f2UserReportSchema.parse(JSON.parse(readFileSync(reportPath, "utf8")));
    const validation = { status: "valid", validatedAt: now().toISOString(), reportPath, reportStatus: report.status };
    writeFileSync(path.join(validationRoot, "Feature2-Validation.json"), `${JSON.stringify(validation, null, 2)}\n`, "utf8");
    manifest.stages.validation = { ...manifest.stages.validation, status: "completed", completedAt: now().toISOString() };
    manifest.status = "completed";
    persistManifest();
  } catch (error) {
    manifest.stages.validation = { ...manifest.stages.validation, status: "failed", failedAt: now().toISOString(), error: errorDetails(error) };
    manifest.status = "failed";
    manifest.error = errorDetails(error);
    persistManifest();
    throw error;
  }

  return { runId, runRoot, f1Root, f2Root, validationRoot, manifestPath };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1) throw new Error("Feature 2 Excel workflow requires exactly one .xlsx workbook.");
    console.log(JSON.stringify(runF2ExcelWorkflow({ workbookPath: args[0] }), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: "failed", error: errorDetails(error) }, null, 2));
    process.exitCode = 1;
  }
}