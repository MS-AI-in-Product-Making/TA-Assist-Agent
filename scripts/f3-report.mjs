import path from "node:path";
import { drawingGovernanceResultV2Schema } from "../packages/contracts/dist/contracts.js";

const TABLE_HEADER = "| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Source Evidence |";
const TABLE_SEPARATOR = "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |";
const WINDOWS_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;
const WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;

function redactSensitiveText(value) {
  return String(value)
    .replace(WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(/Authorization\s*[:=]\s*(?:Bearer\s+)?[^\s|"'`),;\]]+/gi, "Authorization: [redacted]");
}

function cell(value) {
  if (value === null || value === undefined || value === "") return "（缺失）";
  return redactSensitiveText(value).replaceAll("|", "\\|").replaceAll(/\r?\n/g, "<br>");
}

function inlineCode(value) {
  if (value === null || value === undefined || value === "") return "（缺失）";
  const sanitized = redactSensitiveText(value)
    .replaceAll("`", "'")
    .replaceAll(/\r?\n/g, " ");
  return `\`${sanitized}\``;
}

function imageHref(report, outputRoot, imageReference) {
  return path.relative(
    path.resolve(outputRoot),
    path.resolve(report.artifactRoot, imageReference.relativePath),
  ).split(path.sep).join("/");
}

function imageLink(value, href) {
  return `[${cell(value)}](${href})`;
}

function sourceEvidence(row) {
  const fields = Object.entries(row.source.sourceCells)
    .filter(([, sourceCell]) => Boolean(sourceCell))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, sourceCell]) => `${field}=${sourceCell}`);
  return `Worksheet: ${row.source.worksheetName}; Table: ${row.source.tableId}; Row: ${row.source.sourceRow}; Fields: ${fields.length > 0 ? fields.join(", ") : "none"}`;
}

function renderRejected(report) {
  const lines = [
    "# Feature 3 DIM ID 与图纸治理报告",
    "",
    "状态：`input_rejected`",
    "",
    "## 输入问题",
    "",
    "| Reason Code | Artifact Reference |",
    "| --- | --- |",
  ];
  for (const issue of report.artifactIssues) {
    lines.push(`| ${cell(issue.reasonCode)} | ${cell(issue.artifactReference)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function renderAccepted(report, outputRoot) {
  const rows = report.worksheets.flatMap((worksheet) => worksheet.rows);
  const statusCounts = new Map();
  for (const row of rows) statusCounts.set(row.dimIdStatus, (statusCounts.get(row.dimIdStatus) ?? 0) + 1);
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
  ];
  if (report.ado.workItemReference !== undefined) {
    lines.push(`- ADO Work Item：${inlineCode(report.ado.workItemReference)}`);
  }
  if (report.ado.reasonCode !== undefined) {
    lines.push(`- ADO 原因：${cell(report.ado.reasonCode)}`);
  }
  lines.push(
    "",
    "## 质量状态计数",
    "",
    "| DIM ID Status | Count |",
    "| --- | ---: |",
    `| valid | ${statusCounts.get("valid") ?? 0} |`,
    `| missing | ${statusCounts.get("missing") ?? 0} |`,
    `| suspected_invalid | ${statusCounts.get("suspected_invalid") ?? 0} |`,
    `| needs_confirmation | ${statusCounts.get("needs_confirmation") ?? 0} |`,
  );

  const groups = new Map();
  for (const row of rows) {
    const drawingNumber = row.drawingNumber ?? "（缺失）";
    const key = `${row.partCategory}\u0000${drawingNumber}`;
    const group = groups.get(key) ?? { partCategory: row.partCategory, drawingNumber, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const sortedGroups = [...groups.values()].sort((left, right) => left.partCategory.localeCompare(right.partCategory)
    || left.drawingNumber.localeCompare(right.drawingNumber));
  for (const group of sortedGroups) {
    lines.push("", `## ${cell(group.partCategory)} / ${cell(group.drawingNumber)}`, "", TABLE_HEADER, TABLE_SEPARATOR);
    for (const row of group.rows) {
      const href = imageHref(report, outputRoot, row.imageReference);
      lines.push(`| ${imageLink(row.deviceLevelDim, href)} | ${imageLink(row.dimensionDescription, href)} | ${cell(row.partSubsystem)} | ${cell(row.drawingNumber)} | ${cell(row.dimId)} | ${imageLink(row.factorDescription, href)} | ${cell(row.nominal)} | ${cell(row.upperTolerance)} | ${cell(row.lowerTolerance)} | ${cell(row.sigmaLevel)} | ${cell(sourceEvidence(row))} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderF3Report(report, { outputRoot } = {}) {
  const parsed = drawingGovernanceResultV2Schema.parse(report);
  if (parsed.status === "input_rejected") return renderRejected(parsed);
  if (typeof outputRoot !== "string" || outputRoot.length === 0) {
    throw new Error("F3 report outputRoot is required.");
  }
  return renderAccepted(parsed, outputRoot);
}