import { drawingGovernanceResultV2Schema } from "../packages/contracts/dist/contracts.js";

const TABLE_HEADER = "| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Source Location |";
const TABLE_SEPARATOR = "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |";

function redactSensitiveText(value) {
  return String(value)
    .replace(/[A-Za-z]:\\[^\s|]*/g, "[redacted-local-path]")
    .replace(/Authorization\s*[:=]\s*[^\s|]+/gi, "Authorization: [redacted]");
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

function sourceLocation(row) {
  const cells = Object.values(row.source.sourceCells).filter(Boolean).sort();
  return cells.length > 0
    ? cells.join(", ")
    : `${row.source.worksheetName}!row ${row.source.sourceRow}`;
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

function renderAccepted(report) {
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
      lines.push(`| ${cell(row.deviceLevelDim)} | ${cell(row.dimensionDescription)} | ${cell(row.partSubsystem)} | ${cell(row.drawingNumber)} | ${cell(row.dimId)} | ${cell(row.factorDescription)} | ${cell(row.nominal)} | ${cell(row.upperTolerance)} | ${cell(row.lowerTolerance)} | ${cell(row.sigmaLevel)} | ${cell(sourceLocation(row))} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderF3Report(report) {
  const parsed = drawingGovernanceResultV2Schema.parse(report);
  return parsed.status === "input_rejected" ? renderRejected(parsed) : renderAccepted(parsed);
}