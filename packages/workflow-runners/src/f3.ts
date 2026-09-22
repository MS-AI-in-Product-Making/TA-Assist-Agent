import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  createTypedError,
  drawingGovernanceRequestV2Schema,
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  type DrawingGovernanceRequestV2,
  type DrawingGovernanceResultV2,
} from "@ai-assist/contracts";
import { createF3DrawingGovernance } from "@ai-assist/workbook-catalog";

import { normalizeRunnerError } from "./error-normalizer.js";
import { renderF3AdoHistoryHtml } from "./f3-ado-html.js";
import { renderF3AdoMarkdown } from "./f3-ado-markdown.js";
import type { F3AnalysisRequest, F3AnalysisResult, RunContext } from "./types.js";

interface F3OutputLayout {
  readonly outRoot: string;
  readonly reportJsonName: string;
  readonly reportMdName: string;
  readonly workspaceMode?: boolean;
}

export interface F3Dependencies {
  readonly loadBundle?: (artifactRoot: string, options?: { selectedWorksheetNames?: readonly string[] }) => LoadF2ArtifactBundleResult;
  readonly createGovernance?: (request: DrawingGovernanceRequestV2) => DrawingGovernanceResultV2;
  readonly renderReport?: (report: DrawingGovernanceResultV2, options: { outputRoot: string }) => string;
  readonly renderAdoReminder?: (report: DrawingGovernanceResultV2) => string;
  readonly renderAdoHistoryHtml?: (report: DrawingGovernanceResultV2) => string;
  readonly resolveOutputLayout?: (args: readonly string[], managedOutputRoot: string) => F3OutputLayout;
  readonly writeOutputs?: (paths: { reportJsonPath: string; reportMdPath: string; reminderMdPath?: string; historyHtmlPath?: string }, report: DrawingGovernanceResultV2, rendered: { markdown: string; reminder?: string; historyHtml?: string }) => void;
}

type LoadF2ArtifactBundleResult =
  | { readonly status: "accepted"; readonly request: DrawingGovernanceRequestV2 }
  | { readonly status: "inputRejected"; readonly report: DrawingGovernanceResultV2 };

function atomicWrite(filePath: string, content: string): void {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, content, "utf8");
  renameSync(temporaryPath, filePath);
}

function rejected(reasonCode: string, artifactReference: string): LoadF2ArtifactBundleResult {
  return {
    status: "inputRejected",
    report: drawingGovernanceResultV2Schema.parse({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "input_rejected",
      artifactIssues: [{ reasonCode, artifactReference }],
    }),
  };
}

export function loadF2ArtifactBundle(artifactRoot: string, options: { selectedWorksheetNames?: readonly string[] } = {}): LoadF2ArtifactBundleResult {
  const reportPath = path.join(path.resolve(artifactRoot), "Feature2-Report.json");
  try {
    const parsed = f2UserReportSchema.parse(JSON.parse(readFileSync(reportPath, "utf8")));
    if (parsed.status === "inputRejected") return rejected("f2_report_invalid", "Feature2-Report.json");
    const readyWorksheets = parsed.worksheets.filter((worksheet) => worksheet.status === "ready");
    if (readyWorksheets.length === 0) return rejected("no_ready_worksheet", "Feature2-Report.json");
    const readyByName = new Map(readyWorksheets.map((worksheet) => [worksheet.worksheetName, worksheet]));
    let selectedWorksheets = readyWorksheets;
    if (options.selectedWorksheetNames !== undefined) {
      const duplicateNames = options.selectedWorksheetNames.filter((name, index) => options.selectedWorksheetNames?.indexOf(name) !== index);
      const unavailableNames = options.selectedWorksheetNames.filter((name) => !readyByName.has(name));
      if (options.selectedWorksheetNames.length === 0 || duplicateNames.length > 0 || unavailableNames.length > 0) {
        const invalidNames = [...new Set([...duplicateNames, ...unavailableNames])];
        return rejected(
          "worksheet_selection_invalid",
          invalidNames.length > 0 ? `worksheet-selection:${invalidNames.join(",")}` : "worksheet-selection:empty",
        );
      }
      selectedWorksheets = options.selectedWorksheetNames.map((name) => readyByName.get(name)!);
    }
    const missingDescription = selectedWorksheets.find((worksheet) => worksheet.toleranceLoopDescription === undefined);
    if (missingDescription !== undefined) return rejected("description_missing", `worksheet:${missingDescription.worksheetName}`);
    return {
      status: "accepted",
      request: drawingGovernanceRequestV2Schema.parse({
        contractVersion: "v1",
        modelVersion: "drawing-governance-v2",
        inputClassification: "confidential",
        artifactRoot: parsed.artifactRoot,
        workbook: { fileName: parsed.workbook.fileName, contentHash: parsed.workbook.contentHash },
        worksheets: selectedWorksheets.map((worksheet) => ({
          worksheetName: worksheet.worksheetName,
          toleranceLoopDescription: worksheet.toleranceLoopDescription,
          f2Status: "ready",
          rows: worksheet.rows,
        })),
      }),
    };
  } catch {
    return rejected("f2_report_invalid", "Feature2-Report.json");
  }
}

function throwIfAborted(context: RunContext, stage: string): void {
  if (!context.signal.aborted) return;
  throw normalizeRunnerError(new Error(`AbortError: signal already aborted before ${stage}.`), {
    fallbackRunId: context.attemptId,
    affectedInputReferences: [stage],
  });
}

export function resolveFeature3OutputLayout(args: readonly string[], managedOutputRoot: string): F3OutputLayout {
  if (args.length !== 1) throw new Error("Feature 3 workflow requires exactly one Feature 2 artifact directory.");
  if (/\.xls[xm]?$/i.test(args[0] ?? "")) throw new Error("Feature 3 requires a Feature 2 artifact directory, not an Excel workbook.");
  return {
    outRoot: path.resolve(managedOutputRoot),
    reportJsonName: "Feature3-Report.json",
    reportMdName: "Feature3-Report.md",
    workspaceMode: false,
  };
}

function renderRejected(report: DrawingGovernanceResultV2): string {
  if (report.status !== "input_rejected") throw new Error("F3 rejected renderer requires an input_rejected report.");
  const lines = [
    "# Feature 3 DIM ID 与图纸治理报告",
    "",
    "状态：`input_rejected`",
    "",
    "## 输入问题",
    "",
    "| Reason Code | Artifact Reference |",
    "| --- | --- |",
    ...report.artifactIssues.map((issue) => `| ${issue.reasonCode} | ${issue.artifactReference} |`),
  ];
  return `${lines.join("\n")}\n`;
}

function renderAccepted(report: Exclude<DrawingGovernanceResultV2, { status: "input_rejected" }>): string {
  const lines = [
    "# Feature 3 DIM ID 与图纸治理报告",
    "",
    "## 执行摘要",
    "",
    `- 状态：\`${report.status}\``,
    `- Worksheet：${report.summary.worksheetCount}`,
    `- 因子：${report.summary.factorCount}`,
    `- 治理完成：${report.summary.completeCount}`,
    `- 需要治理：${report.summary.governanceRequiredCount}`,
    `- 同图纸重复冲突：${report.summary.duplicateConflictCount}`,
    `- ADO 状态：\`${report.ado.status}\``,
    "",
    "| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Source Evidence |",
    "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const worksheet of report.worksheets) {
    for (const row of worksheet.rows) {
      lines.push(`| ${row.deviceLevelDim} | ${row.dimensionDescription} | ${row.partSubsystem ?? "(missing)"} | ${row.drawingNumber ?? "(missing)"} | ${row.dimId ?? "(missing)"} | ${row.factorDescription} | ${row.nominal} | ${row.upperTolerance} | ${row.lowerTolerance} | ${row.sigmaLevel} | Worksheet: ${row.source.worksheetName}; Table: ${row.source.tableId}; Row: ${row.source.sourceRow} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderF3Report(report: DrawingGovernanceResultV2, options: { outputRoot: string }): string {
  void options;
  return report.status === "input_rejected" ? renderRejected(report) : renderAccepted(report);
}

export function renderF3AdoReminder(report: DrawingGovernanceResultV2): string {
  return renderF3AdoMarkdown(report).markdown;
}

function defaultWriteOutputs(
  paths: { reportJsonPath: string; reportMdPath: string; reminderMdPath?: string; historyHtmlPath?: string },
  report: DrawingGovernanceResultV2,
  rendered: { markdown: string; reminder?: string; historyHtml?: string },
): void {
  atomicWrite(paths.reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(paths.reportMdPath, rendered.markdown);
  if (paths.reminderMdPath && rendered.reminder) atomicWrite(paths.reminderMdPath, rendered.reminder);
  if (paths.historyHtmlPath && rendered.historyHtml) atomicWrite(paths.historyHtmlPath, rendered.historyHtml);
}

function assertGovernedArtifactsAbsent(outputRoot: string, fileNames: readonly string[]): void {
  for (const fileName of fileNames) {
    if (existsSync(path.join(outputRoot, fileName))) {
      throw createTypedError({
        code: "prerequisite_not_ready",
        summary: "Workspace stage already contains published artifacts.",
        suggestedAction: "Choose a fresh analysis workspace stage before rerunning this workflow.",
        affectedInputReferences: [outputRoot],
        details: { reasonCode: "workspace_stage_not_empty" },
      });
    }
  }
}

export function runF3Analysis(
  request: F3AnalysisRequest,
  context: RunContext,
  dependencies: F3Dependencies = {},
): F3AnalysisResult {
  const loadBundle = dependencies.loadBundle ?? loadF2ArtifactBundle;
  const createGovernance = dependencies.createGovernance ?? createF3DrawingGovernance;
  const renderReport = dependencies.renderReport ?? renderF3Report;
  const renderAdoReminder = dependencies.renderAdoReminder ?? renderF3AdoReminder;
  const renderAdoHistoryHtml = dependencies.renderAdoHistoryHtml ?? renderF3AdoHistoryHtml;
  const resolveOutputLayout = dependencies.resolveOutputLayout ?? resolveFeature3OutputLayout;
  const writeOutputs = dependencies.writeOutputs ?? defaultWriteOutputs;
  try {
    throwIfAborted(context, "load_bundle");
    const outputLayout = resolveOutputLayout([request.artifactRoot], request.outputRoot ?? context.managedOutputRoot);
    if (outputLayout.workspaceMode) {
      mkdirSync(outputLayout.outRoot, { recursive: true });
      assertGovernedArtifactsAbsent(outputLayout.outRoot, [
        outputLayout.reportJsonName,
        outputLayout.reportMdName,
        "Feature3-ADO-Reminder.md",
        "Feature3-ADO-History.html",
      ]);
    }
    const loaded = request.selectedWorksheetNames === undefined
      ? loadBundle(request.artifactRoot)
      : loadBundle(request.artifactRoot, { selectedWorksheetNames: request.selectedWorksheetNames });
    throwIfAborted(context, "create_governance");
    const report = loaded.status === "accepted" ? createGovernance(loaded.request) : loaded.report;
    throwIfAborted(context, "write_outputs");
    mkdirSync(outputLayout.outRoot, { recursive: true });
    const reportJsonPath = path.join(outputLayout.outRoot, outputLayout.reportJsonName);
    const reportMdPath = path.join(outputLayout.outRoot, outputLayout.reportMdName);
    const reminderMdPath = report.status === "input_rejected" ? undefined : path.join(outputLayout.outRoot, "Feature3-ADO-Reminder.md");
    const historyHtmlPath = report.status === "input_rejected" ? undefined : path.join(outputLayout.outRoot, "Feature3-ADO-History.html");
    writeOutputs(
      {
        reportJsonPath,
        reportMdPath,
        ...(reminderMdPath ? { reminderMdPath } : {}),
        ...(historyHtmlPath ? { historyHtmlPath } : {}),
      },
      report,
      {
        markdown: renderReport(report, { outputRoot: outputLayout.outRoot }),
        ...(reminderMdPath ? { reminder: renderAdoReminder(report) } : {}),
        ...(historyHtmlPath ? { historyHtml: renderAdoHistoryHtml(report) } : {}),
      },
    );
    throwIfAborted(context, "write_outputs");
    context.emit({ kind: "artifact_written", featureId: "F3", stage: "report", timestamp: new Date().toISOString(), path: reportJsonPath });
    return {
      featureId: "F3",
      status: report.status,
      outputDirectory: outputLayout.outRoot,
      reportJsonPath,
      reportMdPath,
      ...(request.selectedWorksheetNames ? { selectedWorksheetNames: [...request.selectedWorksheetNames] } : {}),
      ...(reminderMdPath ? { reminderMdPath } : {}),
      ...(historyHtmlPath ? { historyHtmlPath } : {}),
      ...(report.status === "input_rejected" ? {} : { ado: report.ado }),
      report,
    };
  } catch (error) {
    throw normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: ["load_bundle", "create_governance", "write_outputs"] });
  }
}