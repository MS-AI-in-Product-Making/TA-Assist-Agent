import { createHash } from "node:crypto";

import {
  createTypedError,
  drawingGovernanceResultV2Schema,
  governanceIssue,
  partSubsystemLabel,
  projectF3AdoGovernanceGroups,
  type DrawingGovernanceResultV2,
  type F3AdoGovernanceGroup,
  type TypedError,
} from "@ai-assist/contracts";

export const F3_ADO_MARKDOWN_TABLE_HEADER = "| Worksheet Source | Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |";
const F3_ADO_MARKDOWN_TABLE_SEPARATOR = "| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |";
const SUMMARY_TABLE_HEADER = "| Field | Value |";
const SUMMARY_TABLE_SEPARATOR = "| --- | --- |";
const GROUP_SUMMARY_TABLE_HEADER = "| Factor count | Missing Drawing Number | Missing DIM ID |";
const GROUP_SUMMARY_TABLE_SEPARATOR = "| ---: | ---: | ---: |";
const WINDOWS_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;
const WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;

export const F3_ADO_MARKDOWN_MAX_LENGTH = 65536;

type AcceptedF3Report = Exclude<DrawingGovernanceResultV2, { status: "input_rejected" }>;
export type F3AdoMarkdownGroup = F3AdoGovernanceGroup;

export interface F3AdoMarkdownRenderResult {
  readonly markdown: string;
  readonly groups: readonly F3AdoMarkdownGroup[];
  readonly contentHash: string;
}

export class F3AdoMarkdownLengthError extends Error implements TypedError {
  readonly code = "validation_error" as const;
  readonly runId: string;
  readonly summary: string;
  readonly retryable = false;
  readonly suggestedAction: string;
  readonly affectedInputReferences: readonly string[];

  constructor(actualLength: number, maxLength: number) {
    const typed = createTypedError({
      code: "validation_error",
      summary: `F3 ADO markdown exceeds governed length limit (${actualLength} > ${maxLength}).`,
      suggestedAction: "Split the governance work into smaller scoped ADO updates before previewing again.",
      affectedInputReferences: ["Feature3-ADO-Reminder.md", "nextContent"],
      details: { actualLength, maxLength },
    });
    super(typed.summary);
    this.name = "F3AdoMarkdownLengthError";
    this.runId = typed.runId;
    this.summary = typed.summary;
    this.suggestedAction = typed.suggestedAction;
    this.affectedInputReferences = typed.affectedInputReferences;
  }
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function redactSensitiveText(value: string): string {
  return value
    .replace(WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(/Authorization\s*[:=]\s*(?:Bearer\s+)?[^\s|]+/gi, "Authorization: [redacted]");
}

function markdownCell(value: unknown): string {
  if (value === null || value === undefined || String(value).trim().length === 0) return "(missing)";
  return redactSensitiveText(String(value))
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/g, "<br>");
}

function acceptedReport(report: DrawingGovernanceResultV2): AcceptedF3Report {
  const parsed = drawingGovernanceResultV2Schema.parse(report);
  if (parsed.status === "input_rejected") throw new Error("Cannot render ADO reminder for input_rejected report.");
  return parsed;
}

function renderSummary(report: AcceptedF3Report): string[] {
  return [
    "### Workbook Summary",
    SUMMARY_TABLE_HEADER,
    SUMMARY_TABLE_SEPARATOR,
    `| Workbook | ${markdownCell(report.workbook.fileName)} |`,
    `| Worksheet count | ${report.summary.worksheetCount} |`,
    `| Factor count | ${report.summary.factorCount} |`,
    `| Governance required count | ${report.summary.governanceRequiredCount} |`,
    `| Duplicate conflict count | ${report.summary.duplicateConflictCount} |`,
    `| ADO status | ${markdownCell(report.ado.status)} |`,
    "",
  ];
}

function renderGroup(group: F3AdoMarkdownGroup): string[] {
  const lines = [
    `### Part / Subsystem: ${markdownCell(group.partSubsystem)} (${group.factorCount} factors)`,
    GROUP_SUMMARY_TABLE_HEADER,
    GROUP_SUMMARY_TABLE_SEPARATOR,
    `| ${group.factorCount} | ${group.missingDrawingNumberCount} | ${group.missingDimIdCount} |`,
    "",
    F3_ADO_MARKDOWN_TABLE_HEADER,
    F3_ADO_MARKDOWN_TABLE_SEPARATOR,
  ];
  for (const row of group.rows) {
    lines.push(`| ${markdownCell(row.source.worksheetName)} | ${markdownCell(row.deviceLevelDim)} | ${markdownCell(row.dimensionDescription)} | ${markdownCell(partSubsystemLabel(row.partSubsystem))} | ${markdownCell(row.drawingNumber)} | ${markdownCell(row.dimId)} | ${markdownCell(row.factorDescription)} | ${markdownCell(row.nominal)} | ${markdownCell(row.upperTolerance)} | ${markdownCell(row.lowerTolerance)} | ${markdownCell(row.sigmaLevel)} | ${markdownCell(governanceIssue(row))} |`);
  }
  lines.push("");
  return lines;
}

export function renderF3AdoMarkdown(report: DrawingGovernanceResultV2): F3AdoMarkdownRenderResult {
  const parsed = acceptedReport(report);
  const groups = projectF3AdoGovernanceGroups(parsed);
  const markdown = [
    "## F3 DIM ID / Drawing Governance Reminder",
    "",
    ...renderSummary(parsed),
    ...groups.flatMap((group) => renderGroup(group)),
  ].join("\n") + "\n";
  if (markdown.length > F3_ADO_MARKDOWN_MAX_LENGTH) {
    throw new F3AdoMarkdownLengthError(markdown.length, F3_ADO_MARKDOWN_MAX_LENGTH);
  }
  return Object.freeze({
    markdown,
    groups,
    contentHash: sha256(markdown),
  });
}