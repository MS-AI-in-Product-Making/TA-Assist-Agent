/* eslint-disable @typescript-eslint/no-explicit-any -- runner facades validate external workflow artifact JSON at schema boundaries. */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  createTypedError,
  f4ExcelComparisonResultSchema,
  f4WorkflowCalculationResultSchema,
} from "@ai-assist/contracts";

import { normalizeRunnerError } from "./error-normalizer.js";
import type { F4CalculationRequest, F4CalculationResult, F4StructuredCalculation, RunContext } from "./types.js";

interface F4Layout {
  readonly runId: string;
  readonly f2ReportPath: string;
  readonly workbookPath?: string;
  readonly runRoot: string;
  readonly calculationJsonName: string;
  readonly reportMdName: string;
  readonly comparisonJsonName: string;
  readonly manifestName: string;
  readonly allowExistingRunRoot?: boolean;
}

export interface F4Dependencies {
  readonly resolveOutputLayout?: (request: F4CalculationRequest, context: RunContext) => F4Layout;
  readonly loadHandoffs?: (reportPath: string) => any;
  readonly calculateWorkflow?: (loaded: any, options: { runId: string; generatedAt?: string }) => unknown;
  readonly buildMapping?: (input: { workbookPath: string; calculation: unknown }) => unknown;
  readonly compareWithExcel?: (input: { workbookPath: string; calculationResult: any; mappings: unknown[] }) => unknown;
  readonly renderReport?: (calculationResult: any, options: { comparisonResult?: any }) => string;
  readonly mkdir?: typeof mkdirSync;
  readonly writeFile?: typeof writeFileSync;
  readonly rename?: typeof renameSync;
  readonly rm?: typeof rmSync;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function atomicWrite(filePath: string, content: string, dependencies: Required<Pick<F4Dependencies, "writeFile" | "rename" | "rm">>): void {
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

function outputPaths(layout: F4Layout) {
  return {
    calculationJsonPath: path.join(layout.runRoot, layout.calculationJsonName),
    comparisonJsonPath: path.join(layout.runRoot, layout.comparisonJsonName),
    reportMdPath: path.join(layout.runRoot, layout.reportMdName),
    manifestPath: path.join(layout.runRoot, layout.manifestName),
  };
}

function assertOutputArtifactsAbsent(paths: ReturnType<typeof outputPaths>): void {
  for (const filePath of Object.values(paths)) {
    if (existsSync(filePath)) {
      throw createTypedError({
        code: "prerequisite_not_ready",
        summary: "Workspace stage already contains published artifacts.",
        suggestedAction: "Choose a fresh analysis workspace stage before rerunning this workflow.",
        affectedInputReferences: [filePath],
        details: { reasonCode: "workspace_stage_not_empty" },
      });
    }
  }
}

function completedManifest(layout: F4Layout, calculationResult: any, comparisonResult?: any) {
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

function failedManifest(layout: F4Layout, reasonCode: string, artifacts: Record<string, string> = {}, comparisonStatus = "not_started") {
  return {
    contractVersion: "v1",
    featureId: "F4",
    status: "failed",
    runId: layout.runId,
    reasonCode,
    calculationStatus: artifacts.calculation ? "completed" : "failed",
    comparisonStatus,
    artifacts,
  };
}

function reasonCodeForLoadedResult(loaded: any): string {
  if (loaded && typeof loaded.reasonCode === "string") return loaded.reasonCode;
  return "f2_input_rejected";
}

function validateCalculationAssociation(layout: F4Layout, loaded: any, calculationResult: any): void {
  if (calculationResult.runId !== layout.runId
    || calculationResult.source.artifactReference !== loaded.reportPath
    || calculationResult.source.workbookFileName !== loaded.workbook?.fileName
    || calculationResult.source.workbookContentHash !== loaded.workbook?.contentHash) {
    throw new Error("F4 calculation association is invalid.");
  }

  const expectedSelections = new Set<string>();
  for (const handoff of loaded.handoffs ?? []) {
    const tableIds = new Set((handoff?.factors ?? []).map((factor: { tableId: string }) => factor.tableId));
    if (typeof handoff?.worksheetName !== "string" || tableIds.size !== 1) {
      throw new Error("F4 calculation association is invalid.");
    }
    expectedSelections.add(`${handoff.worksheetName}\0${[...tableIds][0]}`);
  }
  const actualSelections = new Set(calculationResult.calculations.map((calculation: any) => (
    `${calculation.worksheetSelection.worksheetName}\0${calculation.worksheetSelection.tableId}`
  )));
  if (expectedSelections.size !== actualSelections.size
    || [...expectedSelections].some((selection) => !actualSelections.has(selection))) {
    throw new Error("F4 calculation association is invalid.");
  }
}

function validateComparisonAssociation(calculationResult: any, comparisonResult: any): void {
  if (comparisonResult.runId !== calculationResult.runId) {
    throw new Error("F4 comparison association is invalid.");
  }
  if (comparisonResult.status !== "passed" && comparisonResult.status !== "mismatch") return;
  if (comparisonResult.source.workbookContentHash !== calculationResult.source.workbookContentHash) {
    throw new Error("F4 comparison association is invalid.");
  }
  const calculationWorksheets = new Set(
    calculationResult.calculations.map((item: any) => item.worksheetSelection.worksheetName),
  );
  const comparisonWorksheets = new Set(comparisonResult.worksheets.map((item: any) => item.worksheetName));
  if (calculationWorksheets.size !== comparisonWorksheets.size
    || [...calculationWorksheets].some((worksheetName) => !comparisonWorksheets.has(worksheetName))) {
    throw new Error("F4 comparison association is invalid.");
  }
}

function throwIfAborted(context: RunContext, stage: string): void {
  if (!context.signal.aborted) return;
  throw normalizeRunnerError(new Error(`AbortError: signal already aborted before ${stage}.`), {
    fallbackRunId: context.attemptId,
    affectedInputReferences: [stage],
  });
}

function structuredCalculations(calculationResult: any, selectedWorksheetNames?: readonly string[]): {
  acceptedCalculations: F4StructuredCalculation[];
  extraCalculations: F4StructuredCalculation[];
} {
  const selected = selectedWorksheetNames === undefined
    ? undefined
    : new Set(selectedWorksheetNames);
  const acceptedCalculations: F4StructuredCalculation[] = [];
  const extraCalculations: F4StructuredCalculation[] = [];
  for (const calculation of calculationResult.calculations) {
    const structured = {
      worksheetName: calculation.worksheetSelection.worksheetName,
      tableId: calculation.worksheetSelection.tableId,
      calculation,
    } satisfies F4StructuredCalculation;
    if (selected === undefined || selected.has(structured.worksheetName)) acceptedCalculations.push(structured);
    else extraCalculations.push(structured);
  }
  if (selected !== undefined) {
    const acceptedNames = new Set(acceptedCalculations.map((item) => item.worksheetName));
    for (const worksheetName of selectedWorksheetNames ?? []) {
      if (!acceptedNames.has(worksheetName)) throw new Error("F4 downstream scope mismatch.");
    }
  }
  return { acceptedCalculations, extraCalculations };
}

export function runF4Calculation(
  request: F4CalculationRequest,
  context: RunContext,
  dependencies: F4Dependencies = {},
): F4CalculationResult {
  const resolveOutputLayout = dependencies.resolveOutputLayout;
  const loadHandoffs = dependencies.loadHandoffs;
  const calculateWorkflow = dependencies.calculateWorkflow;
  const renderReport = dependencies.renderReport;
  const mkdir = dependencies.mkdir ?? mkdirSync;
  const writeFile = dependencies.writeFile ?? writeFileSync;
  const rename = dependencies.rename ?? renameSync;
  const rm = dependencies.rm ?? rmSync;
  const buildMapping = dependencies.buildMapping;
  const compareWithExcel = dependencies.compareWithExcel;

  if (!resolveOutputLayout || !loadHandoffs || !calculateWorkflow || !renderReport) {
    throw normalizeRunnerError(new Error("Feature 4 runner dependency is missing."), {
      fallbackRunId: context.attemptId,
      affectedInputReferences: ["f4"],
    });
  }

  let layout: F4Layout | undefined;
  let paths: ReturnType<typeof outputPaths> | undefined;
  let calculationWritten = false;
  let comparisonWritten = false;
  let reportWritten = false;
  let comparisonResult: any;
  let loadStarted = false;
  try {
    throwIfAborted(context, "resolve_output_layout");
    layout = resolveOutputLayout(request, context);
    paths = outputPaths(layout);
    mkdir(path.dirname(layout.runRoot), { recursive: true });
    if (layout.allowExistingRunRoot) {
      mkdir(layout.runRoot, { recursive: true });
      assertOutputArtifactsAbsent(paths);
    } else {
      mkdir(layout.runRoot);
    }

    loadStarted = true;
    throwIfAborted(context, "load_handoffs");
    const loaded = loadHandoffs(layout.f2ReportPath);
    if (loaded?.status !== "accepted") {
      const reasonCode = reasonCodeForLoadedResult(loaded);
      atomicWrite(paths.manifestPath, json(failedManifest(layout, reasonCode)), { writeFile, rename, rm });
      return { featureId: "F4", status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: paths.manifestPath };
    }

    throwIfAborted(context, "calculate_workflow");
    const calculationResult = f4WorkflowCalculationResultSchema.parse(calculateWorkflow(loaded, {
      runId: layout.runId,
      ...(request.generatedAt === undefined ? {} : { generatedAt: request.generatedAt }),
    }));
    validateCalculationAssociation(layout, loaded, calculationResult);

    const artifacts: Record<string, string> = {};
    atomicWrite(paths.calculationJsonPath, json(calculationResult), { writeFile, rename, rm });
    artifacts.calculation = layout.calculationJsonName;
    calculationWritten = true;

    if (layout.workbookPath !== undefined && buildMapping && compareWithExcel) {
      const workbookPath = layout.workbookPath;
      const mappings = calculationResult.calculations.map((calculation: any) => ({
        worksheetName: calculation.worksheetSelection.worksheetName,
        mapping: buildMapping({ workbookPath, calculation }),
      }));
      comparisonResult = f4ExcelComparisonResultSchema.parse(compareWithExcel({
        workbookPath,
        calculationResult,
        mappings,
      }));
      validateComparisonAssociation(calculationResult, comparisonResult);
      atomicWrite(paths.comparisonJsonPath, json(comparisonResult), { writeFile, rename, rm });
      artifacts.comparison = layout.comparisonJsonName;
      comparisonWritten = true;
    }

    const markdown = renderReport(calculationResult, { comparisonResult });
    atomicWrite(paths.reportMdPath, markdown, { writeFile, rename, rm });
    artifacts.report = layout.reportMdName;
    reportWritten = true;
    atomicWrite(paths.manifestPath, json(completedManifest(layout, calculationResult, comparisonResult)), { writeFile, rename, rm });

    const structured = structuredCalculations(calculationResult, request.selectedWorksheetNames);
    context.emit({ kind: "artifact_written", featureId: "F4", stage: "report", timestamp: new Date().toISOString(), path: paths.calculationJsonPath });
    return {
      featureId: "F4",
      status: "completed",
      outputDirectory: layout.runRoot,
      calculationJsonPath: paths.calculationJsonPath,
      ...(comparisonResult ? { comparisonJsonPath: paths.comparisonJsonPath, comparisonResult } : {}),
      reportMdPath: paths.reportMdPath,
      manifestPath: paths.manifestPath,
      acceptedCalculations: structured.acceptedCalculations,
      extraCalculations: structured.extraCalculations,
      calculationResult,
      summary: calculationResult.summary,
    };
  } catch (error) {
    if (!loadStarted) throw error;
    if (layout && paths) {
      const reasonCode = calculationWritten ? "workflow_output_failed" : "calculation_failed";
      const manifest = {
        ...failedManifest(
          layout,
          reasonCode,
          {
            ...(calculationWritten ? { calculation: layout.calculationJsonName } : {}),
            ...(comparisonWritten ? { comparison: layout.comparisonJsonName } : {}),
            ...(reportWritten ? { report: layout.reportMdName } : {}),
          },
          comparisonWritten ? comparisonResult?.status ?? "not_started" : "not_started",
        ),
      };
      atomicWrite(paths.manifestPath, json(manifest), { writeFile, rename, rm });
      return { featureId: "F4", status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: paths.manifestPath };
    }
    throw normalizeRunnerError(error, {
      fallbackRunId: context.attemptId,
      affectedInputReferences: ["f4"],
    });
  }
}