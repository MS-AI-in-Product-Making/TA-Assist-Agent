import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  f4ExcelComparisonResultSchema,
  f4WorkflowCalculationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import { loadF4Handoffs } from "./f4-artifact-loader.mjs";
import { calculateF4Workflow } from "./f4-calculation-workflow.mjs";
import { compareF4WithExcel } from "./f4-excel-comparison.mjs";
import { buildF4ExcelMapping } from "./f4-excel-mapping.mjs";
import { resolveFeature4OutputLayout } from "./f4-output-layout.mjs";
import { renderF4Report } from "./f4-report.mjs";

function atomicWrite(filePath, content, dependencies) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  let committed = false;
  try {
    dependencies.writeFile(temporaryPath, content, "utf8");
    dependencies.rename(temporaryPath, filePath);
    committed = true;
  } finally {
    if (!committed) dependencies.rm(temporaryPath, { force: true });
  }
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function outputPaths(layout) {
  return {
    calculationJsonPath: path.join(layout.runRoot, layout.calculationJsonName),
    comparisonJsonPath: path.join(layout.runRoot, layout.comparisonJsonName),
    reportMdPath: path.join(layout.runRoot, layout.reportMdName),
    manifestPath: path.join(layout.runRoot, layout.manifestName),
  };
}

function completedManifest(layout, calculationResult, comparisonResult) {
  return {
    contractVersion: "v1",
    featureId: "F4",
    status: "completed",
    runId: calculationResult.runId,
    generatedAt: calculationResult.generatedAt,
    calculationStatus: calculationResult.status,
    comparisonStatus: comparisonResult?.status ?? "not_requested",
    artifacts: {
      calculation: layout.calculationJsonName,
      report: layout.reportMdName,
      ...(comparisonResult ? { comparison: layout.comparisonJsonName } : {}),
    },
  };
}

function failedManifest(layout, reasonCode) {
  return {
    contractVersion: "v1",
    featureId: "F4",
    status: "failed",
    runId: layout.runId,
    reasonCode,
    calculationStatus: "failed",
    comparisonStatus: "not_started",
    artifacts: {},
  };
}

function reasonCodeForLoadedResult(loaded) {
  if (loaded && typeof loaded.reasonCode === "string") return loaded.reasonCode;
  return "f2_input_rejected";
}

function validateCalculationAssociation(layout, loaded, calculationResult) {
  if (calculationResult.runId !== layout.runId
    || calculationResult.source.artifactReference !== loaded.reportPath
    || calculationResult.source.workbookFileName !== loaded.workbook?.fileName
    || calculationResult.source.workbookContentHash !== loaded.workbook?.contentHash) {
    throw new Error("F4 calculation association is invalid.");
  }

  const expectedSelections = new Set();
  for (const handoff of loaded.handoffs ?? []) {
    const tableIds = new Set(handoff?.factors?.map((factor) => factor.tableId));
    if (typeof handoff?.worksheetName !== "string" || tableIds.size !== 1) {
      throw new Error("F4 calculation association is invalid.");
    }
    expectedSelections.add(`${handoff.worksheetName}\0${[...tableIds][0]}`);
  }
  const actualSelections = new Set(calculationResult.calculations.map((calculation) => (
    `${calculation.worksheetSelection.worksheetName}\0${calculation.worksheetSelection.tableId}`
  )));
  if (expectedSelections.size !== actualSelections.size
    || [...expectedSelections].some((selection) => !actualSelections.has(selection))) {
    throw new Error("F4 calculation association is invalid.");
  }
}

function validateComparisonAssociation(calculationResult, comparisonResult) {
  if (comparisonResult.runId !== calculationResult.runId) {
    throw new Error("F4 comparison association is invalid.");
  }
  if (comparisonResult.status !== "passed" && comparisonResult.status !== "mismatch") return;
  if (comparisonResult.source.workbookContentHash !== calculationResult.source.workbookContentHash) {
    throw new Error("F4 comparison association is invalid.");
  }

  const calculationWorksheets = new Set(
    calculationResult.calculations.map((item) => item.worksheetSelection.worksheetName),
  );
  const comparisonWorksheets = new Set(comparisonResult.worksheets.map((item) => item.worksheetName));
  if (calculationWorksheets.size !== comparisonWorksheets.size
    || [...calculationWorksheets].some((worksheetName) => !comparisonWorksheets.has(worksheetName))) {
    throw new Error("F4 comparison association is invalid.");
  }
}

function normalizeDependencies(overrides = {}) {
  return {
    resolveLayout: overrides.resolveLayout ?? ((args) => resolveFeature4OutputLayout(
      args,
      process.env.AI_TVA_F4_OUTPUT_ROOT,
    )),
    loadHandoffs: overrides.loadHandoffs ?? loadF4Handoffs,
    calculateWorkflow: overrides.calculateWorkflow ?? calculateF4Workflow,
    buildMapping: overrides.buildMapping ?? buildF4ExcelMapping,
    compareWithExcel: overrides.compareWithExcel ?? compareF4WithExcel,
    renderReport: overrides.renderReport ?? renderF4Report,
    mkdir: overrides.mkdir ?? mkdirSync,
    writeFile: overrides.writeFile ?? writeFileSync,
    rename: overrides.rename ?? renameSync,
    rm: overrides.rm ?? rmSync,
  };
}

export function runF4FullValidation(options = {}, dependencyOverrides = {}) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const args = options.args ?? [];
  const layout = dependencies.resolveLayout(args);
  const paths = outputPaths(layout);
  dependencies.mkdir(path.dirname(layout.runRoot), { recursive: true });
  dependencies.mkdir(layout.runRoot);

  let calculationWritten = false;
  let comparisonWritten = false;
  let reportWritten = false;
  let comparisonResult;
  try {
    const loaded = dependencies.loadHandoffs(layout.f2ReportPath);
    if (loaded?.status !== "accepted") {
      const reasonCode = reasonCodeForLoadedResult(loaded);
      atomicWrite(paths.manifestPath, json(failedManifest(layout, reasonCode)), dependencies);
      return { status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: paths.manifestPath };
    }

    const calculationResult = f4WorkflowCalculationResultSchema.parse(dependencies.calculateWorkflow(loaded, {
      runId: layout.runId,
      generatedAt: options.generatedAt,
    }));
    validateCalculationAssociation(layout, loaded, calculationResult);
    atomicWrite(paths.calculationJsonPath, json(calculationResult), dependencies);
    calculationWritten = true;

    if (layout.workbookPath) {
      const mappings = calculationResult.calculations.map((calculation) => ({
        worksheetName: calculation.worksheetSelection.worksheetName,
        mapping: dependencies.buildMapping({ workbookPath: layout.workbookPath, calculation }),
      }));
      comparisonResult = f4ExcelComparisonResultSchema.parse(dependencies.compareWithExcel({
        workbookPath: layout.workbookPath,
        calculationResult,
        mappings,
      }));
      validateComparisonAssociation(calculationResult, comparisonResult);
      atomicWrite(paths.comparisonJsonPath, json(comparisonResult), dependencies);
      comparisonWritten = true;
    }

    const markdown = dependencies.renderReport(calculationResult, { comparisonResult });
    atomicWrite(paths.reportMdPath, markdown, dependencies);
    reportWritten = true;
    const manifest = completedManifest(layout, calculationResult, comparisonResult);
    atomicWrite(paths.manifestPath, json(manifest), dependencies);

    return {
      status: "completed",
      outputDirectory: layout.runRoot,
      calculationJsonPath: paths.calculationJsonPath,
      reportMdPath: paths.reportMdPath,
      manifestPath: paths.manifestPath,
      ...(comparisonResult ? {
        comparisonJsonPath: paths.comparisonJsonPath,
        comparisonStatus: comparisonResult.status,
      } : {}),
      summary: calculationResult.summary,
    };
  } catch {
    const reasonCode = calculationWritten ? "workflow_output_failed" : "calculation_failed";
    const manifest = {
      ...failedManifest(layout, reasonCode),
      ...(calculationWritten ? {
        calculationStatus: "completed",
        comparisonStatus: comparisonWritten ? comparisonResult.status : "not_started",
        artifacts: {
          calculation: layout.calculationJsonName,
          ...(comparisonWritten ? { comparison: layout.comparisonJsonName } : {}),
          ...(reportWritten ? { report: layout.reportMdName } : {}),
        },
      } : {}),
    };
    atomicWrite(paths.manifestPath, json(manifest), dependencies);
    return { status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: paths.manifestPath };
  }
}

function isDirectExecution() {
  return process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  try {
    const result = runF4FullValidation({ args: process.argv.slice(2) });
    console.log(json(result).trimEnd());
    if (result.status !== "completed") process.exitCode = 1;
  } catch {
    console.log(json({ status: "failed", reasonCode: "invalid_arguments_or_output_root" }).trimEnd());
    process.exitCode = 1;
  }
}