import { drawingGovernanceResultV2Schema } from "../packages/contracts/dist/contracts.js";

export const ADO_TABLE_HEADER = "| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |";
const ADO_TABLE_SEPARATOR = "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |";
export const ADO_HTML_TABLE_HEADERS = [
  "Device Level Dim",
  "Dimension Description",
  "Part / Subsystem",
  "Drawing Number",
  "Dim ID",
  "Factor Description",
  "Nominal",
  "Upper Tolerance (+)",
  "Lower Tolerance (-)",
  "σ Level",
  "Governance issue",
];

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

function htmlCell(value) {
  const text = value === null || value === undefined || value === ""
    ? "(missing)"
    : redactSensitiveText(value);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll(/\r?\n/g, "<br>");
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

export function renderF3AdoReminder(report) {
  const parsed = drawingGovernanceResultV2Schema.parse(report);
  if (parsed.status === "input_rejected") {
    throw new Error("Cannot render ADO reminder for input_rejected report.");
  }

  const rows = parsed.worksheets.flatMap((worksheet) => worksheet.rows);
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
    ADO_TABLE_HEADER,
    ADO_TABLE_SEPARATOR,
  ];

  for (const row of rows) {
    lines.push(`| ${cell(row.deviceLevelDim)} | ${cell(row.dimensionDescription)} | ${cell(row.partSubsystem)} | ${cell(row.drawingNumber)} | ${cell(row.dimId)} | ${cell(row.factorDescription)} | ${cell(row.nominal)} | ${cell(row.upperTolerance)} | ${cell(row.lowerTolerance)} | ${cell(row.sigmaLevel)} | ${cell(governanceIssue(row))} |`);
  }

  return `${lines.join("\n")}\n`;
}

export function renderF3AdoHistoryHtml(report) {
  const parsed = drawingGovernanceResultV2Schema.parse(report);
  if (parsed.status === "input_rejected") {
    throw new Error("Cannot render ADO history HTML for input_rejected report.");
  }

  const rows = parsed.worksheets.flatMap((worksheet) => worksheet.rows);
  const header = `<thead><tr>${ADO_HTML_TABLE_HEADERS.map((name) => `<th>${htmlCell(name)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${rows.map((row) => `<tr>${[
    row.deviceLevelDim,
    row.dimensionDescription,
    row.partSubsystem,
    row.drawingNumber,
    row.dimId,
    row.factorDescription,
    row.nominal,
    row.upperTolerance,
    row.lowerTolerance,
    row.sigmaLevel,
    governanceIssue(row),
  ].map((value) => `<td>${htmlCell(value)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  const actions = requestedActions(parsed.summary.governanceRequiredCount)
    .map((action) => `<li>${htmlCell(action)}</li>`)
    .join("");

  return [
    "<h2>F3 DIM ID / Drawing Governance Reminder</h2>",
    `<p><strong>Workbook:</strong> ${htmlCell(parsed.workbook.fileName)}</p>`,
    `<p><strong>Worksheet count:</strong> ${parsed.summary.worksheetCount}<br><strong>Factor count:</strong> ${parsed.summary.factorCount}<br><strong>Governance required count:</strong> ${parsed.summary.governanceRequiredCount}<br><strong>Duplicate conflict count:</strong> ${parsed.summary.duplicateConflictCount}</p>`,
    `<p><strong>Requested actions:</strong></p><ul>${actions}</ul>`,
    `<table>${header}${body}</table>`,
  ].join("\n") + "\n";
}
