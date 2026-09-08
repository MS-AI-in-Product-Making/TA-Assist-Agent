import { drawingGovernanceResultV2Schema } from "../packages/contracts/dist/contracts.js";
import {
  F3_ADO_HTML_TABLE_HEADERS,
  renderF3AdoHistoryHtml as renderCanonicalF3AdoHistoryHtml,
} from "../packages/workflow-runners/dist/index.js";

export const ADO_TABLE_HEADER = "| Worksheet Source | Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |";
const ADO_TABLE_SEPARATOR = "| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |";
export const ADO_HTML_TABLE_HEADERS = F3_ADO_HTML_TABLE_HEADERS;

const QUALITY_SIGNAL_MESSAGES = {
  drawing_number_missing: "Drawing Number missing",
  dim_id_missing: "DIM ID missing",
  dim_id_suspected_invalid: "DIM ID suspected invalid",
  dim_id_needs_confirmation: "DIM ID needs confirmation",
  duplicate_conflict: "Duplicate Drawing Number and DIM ID conflict",
};

const QUALITY_SIGNAL_ORDER = [
  "drawing_number_missing",
  "dim_id_missing",
  "dim_id_suspected_invalid",
  "dim_id_needs_confirmation",
  "duplicate_conflict",
];
const WINDOWS_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;
const WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;

function redactSensitiveText(value) {
  return String(value)
    .replace(WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(/Authorization\s*[:=]\s*(?:Bearer\s+)?[^\s|]+/gi, "Authorization: [redacted]");
}

function cell(value) {
  if (value === null || value === undefined || value === "") return "(missing)";
  return redactSensitiveText(value).replaceAll("|", "\\|").replaceAll(/\r?\n/g, "<br>");
}

export function normalizeAdoHistoryHtmlForVerification(value) {
  return String(value)
    .trimEnd()
    .replace(/\s+(?=<\/(?:h2|p|li|ul|th|td)>)/g, "");
}

export function governanceIssue(row) {
  const issues = QUALITY_SIGNAL_ORDER
    .filter((signal) => row.qualitySignals.includes(signal))
    .map((signal) => QUALITY_SIGNAL_MESSAGES[signal]);
  return issues.length > 0 ? issues.join("; ") : "Complete";
}

function requestedActions(governanceRequiredCount) {
  if (governanceRequiredCount === 0) {
    return ["No action required. Governance is complete."];
  }
  return [
    "Fill in missing Drawing Number and DIM ID fields in the source workbook.",
    "Confirm or correct suspected/uncertain DIM IDs.",
    "Resolve duplicate Drawing Number and DIM ID conflicts before the next run.",
    "Re-run F3 after updates to refresh governance status.",
  ];
}

function partSubsystemLabel(value) {
  if (value === null || value === undefined) return "(missing Part / Subsystem)";
  const text = String(value).trim();
  if (text.length === 0 || text === "(missing)") return "(missing Part / Subsystem)";
  return text;
}

function groupedPartSubsystemRows(worksheets) {
  const groups = [];
  const bySubsystem = new Map();
  for (const worksheet of worksheets) {
    for (const row of worksheet.rows) {
      const subsystem = partSubsystemLabel(row.partSubsystem);
      if (!bySubsystem.has(subsystem)) {
        bySubsystem.set(subsystem, []);
        groups.push({ subsystem, rows: bySubsystem.get(subsystem) });
      }
      bySubsystem.get(subsystem).push(row);
    }
  }
  return groups;
}

export function renderF3AdoReminder(report) {
  const parsed = drawingGovernanceResultV2Schema.parse(report);
  if (parsed.status === "input_rejected") {
    throw new Error("Cannot render ADO reminder for input_rejected report.");
  }

  const groups = groupedPartSubsystemRows(parsed.worksheets);
  const lines = [
    "## F3 DIM ID / Drawing Governance Reminder",
    "",
    `Workbook: ${cell(parsed.workbook.fileName)}`,
    `Worksheet count: ${parsed.summary.worksheetCount}`,
    `Factor count: ${parsed.summary.factorCount}`,
    `Governance required count: ${parsed.summary.governanceRequiredCount}`,
    `Duplicate conflict count: ${parsed.summary.duplicateConflictCount}`,
    "Requested actions:",
    ...requestedActions(parsed.summary.governanceRequiredCount).map((action) => `- ${action}`),
    "",
  ];

  for (const group of groups) {
    lines.push(`### Part / Subsystem: ${cell(group.subsystem)} (${group.rows.length} factors)`);
    lines.push(ADO_TABLE_HEADER);
    lines.push(ADO_TABLE_SEPARATOR);
    for (const row of group.rows) {
      lines.push(`| ${cell(row.source.worksheetName)} | ${cell(row.deviceLevelDim)} | ${cell(row.dimensionDescription)} | ${cell(partSubsystemLabel(row.partSubsystem))} | ${cell(row.drawingNumber)} | ${cell(row.dimId)} | ${cell(row.factorDescription)} | ${cell(row.nominal)} | ${cell(row.upperTolerance)} | ${cell(row.lowerTolerance)} | ${cell(row.sigmaLevel)} | ${cell(governanceIssue(row))} |`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function renderF3AdoHistoryHtml(report) {
  return renderCanonicalF3AdoHistoryHtml(report);
}
