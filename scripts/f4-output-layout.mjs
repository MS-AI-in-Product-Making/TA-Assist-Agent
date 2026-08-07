import path from "node:path";
import { safeName } from "./f1-output-layout.mjs";

function outputRootOverride(value) {
  if (value === undefined) return undefined;
  if (!value.trim() || value.split(/[\\/]+/).includes("..")) throw new Error("Feature 4 output root override is unsafe.");
  return value;
}

function ensureFlagValue(args, index, flagName) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Feature 4 ${flagName} value is missing.`);
  }
  return value;
}

function parseCliArgs(args) {
  const flags = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) throw new Error(`Feature 4 option is unsupported: ${token}`);
    if (token !== "--f2-report" && token !== "--workbook") {
      throw new Error(`Feature 4 option is unsupported: ${token}`);
    }
    if (flags.has(token)) throw new Error(`Feature 4 option is duplicated: ${token}`);

    const value = ensureFlagValue(args, index, token);
    flags.set(token, value);
    index += 1;
  }

  if (!flags.has("--f2-report")) throw new Error("Feature 4 requires exactly one --f2-report option.");
  return {
    f2ReportPath: flags.get("--f2-report"),
    workbookPath: flags.get("--workbook"),
  };
}

function validateF2ReportPath(reportPath) {
  if (path.basename(reportPath) !== "Feature2-Report.json") {
    throw new Error("Feature 4 --f2-report must point to Feature2-Report.json.");
  }
}

function validateWorkbookPath(workbookPath) {
  if (path.extname(workbookPath) !== ".xlsx") {
    throw new Error("Feature 4 --workbook must point to a .xlsx workbook.");
  }
}

export function resolveFeature4OutputLayout(args, outputRoot, now = () => new Date()) {
  const override = outputRootOverride(outputRoot);
  const { f2ReportPath, workbookPath } = parseCliArgs(args);

  validateF2ReportPath(f2ReportPath);
  if (workbookPath !== undefined) validateWorkbookPath(workbookPath);

  const runId = now().toISOString().replace(/[:.]/g, "-");
  const stemSource = workbookPath
    ? path.basename(workbookPath, path.extname(workbookPath))
    : path.basename(f2ReportPath, path.extname(f2ReportPath));
  const runStem = safeName(stemSource);
  if (!runStem) throw new Error("Feature 4 output name is empty.");

  const runRootBase = override ?? path.posix.join("test", "demo-output", "f4-runs", runStem);
  return {
    runId,
    f2ReportPath,
    workbookPath,
    runRoot: path.posix.join(runRootBase, runId),
    calculationJsonName: "Feature4-Calculation.json",
    reportMdName: "Feature4-Report.md",
    comparisonJsonName: "Feature4-Comparison.json",
    manifestName: "manifest.json",
    validationDirName: "validation",
  };
}
