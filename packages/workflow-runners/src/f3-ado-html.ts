import {
  drawingGovernanceResultV2Schema,
  governanceIssue,
  projectF3AdoGovernanceGroups,
  type DrawingGovernanceResultV2,
} from "@ai-assist/contracts";

export const F3_ADO_HTML_TABLE_HEADERS = [
  "Worksheet Source",
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
] as const;

const WINDOWS_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;
const WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;

function redactSensitiveText(value: unknown): string {
  return String(value)
    .replace(WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(/Authorization\s*[:=]\s*(?:Bearer\s+)?[^\s|]+/gi, "Authorization: [redacted]");
}

function htmlCell(value: unknown): string {
  const text = value === null || value === undefined || value === "" ? "(missing)" : redactSensitiveText(value);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll(/\r?\n/g, "<br>");
}

function requestedActions(governanceRequiredCount: number): readonly string[] {
  if (governanceRequiredCount === 0) return ["No action required. Governance is complete."];
  return [
    "Fill in missing Drawing Number and DIM ID fields in the source workbook.",
    "Confirm or correct suspected/uncertain DIM IDs.",
    "Resolve duplicate Drawing Number and DIM ID conflicts before the next run.",
    "Re-run F3 after updates to refresh governance status.",
  ];
}

export function renderF3AdoHistoryHtml(report: DrawingGovernanceResultV2): string {
  const parsed = drawingGovernanceResultV2Schema.parse(report);
  if (parsed.status === "input_rejected") throw new Error("Cannot render ADO history HTML for input_rejected report.");

  const groups = projectF3AdoGovernanceGroups(parsed);
  const header = `<thead><tr>${F3_ADO_HTML_TABLE_HEADERS.map((name) => `<th>${htmlCell(name)}</th>`).join("")}</tr></thead>`;
  const bodyRows = groups.flatMap((group) => [
    `<tr data-f3-group-row=true><td colspan=12>${htmlCell(`Part / Subsystem: ${group.partSubsystem} (${group.factorCount} factors)`)}</td></tr>`,
    ...group.rows.map((row) => `<tr data-f3-factor-row=true>${[
      row.source.worksheetName,
      row.deviceLevelDim,
      row.dimensionDescription,
      group.partSubsystem,
      row.drawingNumber,
      row.dimId,
      row.factorDescription,
      row.nominal,
      row.upperTolerance,
      row.lowerTolerance,
      row.sigmaLevel,
      governanceIssue(row),
    ].map((value) => `<td>${htmlCell(value)}</td>`).join("")}</tr>`),
  ]);
  const actions = requestedActions(parsed.summary.governanceRequiredCount)
    .map((action) => `<li>${htmlCell(action)}</li>`)
    .join("");

  return [
    "<h2>F3 DIM ID / Drawing Governance Reminder</h2>",
    `<p><strong>Workbook:</strong> ${htmlCell(parsed.workbook.fileName)}</p>`,
    `<p><strong>Worksheet count:</strong> ${parsed.summary.worksheetCount}<br><strong>Factor count:</strong> ${parsed.summary.factorCount}<br><strong>Governance required count:</strong> ${parsed.summary.governanceRequiredCount}<br><strong>Duplicate conflict count:</strong> ${parsed.summary.duplicateConflictCount}</p>`,
    `<p><strong>Requested actions:</strong></p><ul>${actions}</ul>`,
    `<table>${header}<tbody>${bodyRows.join("")}</tbody></table>`,
  ].join("\n") + "\n";
}