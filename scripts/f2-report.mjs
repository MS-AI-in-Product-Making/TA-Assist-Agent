function mdEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

const fieldLabels = { factorName: "Factor Description", partName: "Part Name", partCategory: "Part Category", nominalValue: "Design Nominal", upperTolerance: "+ Tolerance", lowerTolerance: "- Tolerance", longTermSafetyFactor: "Long Term/Safety Factor", standardDeviation: "Sigma Level", distribution: "Distribution", tolerancePathImage: "截面图" };
const capabilityLabels = { in_library_recommended: "库内-符合推荐", in_library_tolerance_outside: "库内-公差超出推荐", in_library_distribution_differs: "库内-分布不同", in_library_tolerance_and_distribution_differ: "库内-公差及分布不同", outside_library: "库外", unable_to_check: "无法检查" };
const artifactIssueLabels = { root_json_missing: "缺少 F1 根 JSON", root_md_missing: "缺少 F1 根 Markdown", manifest_missing: "缺少 worksheet manifest", worksheet_json_missing: "缺少 worksheet JSON", worksheet_md_missing: "缺少 worksheet Markdown", workbook_identity_mismatch: "artifact 身份或内容不一致", image_missing: "缺少截面图文件", image_empty: "截面图文件为空", image_unsupported: "截面图格式不支持", path_outside_root: "artifact 路径越界", invalid_json: "JSON 无法解析", invalid_contract: "F1 artifact 格式不受支持" };

function recommendationText(row) {
  const value = row.recommendation;
  return value ? `${value.toleranceMin}–${value.toleranceMax} ${value.unit} / ${value.distribution}` : "—";
}

function renderRejected(report) {
  const lines = ["# Feature 2 数据检查报告", "", "## F1 输出不完整", "", "F2 未开始业务检查。请补齐下列 F1 输出文件后重新运行。", "", "| 缺失或异常项目 | Artifact |", "|---|---|"];
  for (const issue of report.artifactIssues) lines.push(`| ${mdEscape(artifactIssueLabels[issue.reasonCode] ?? "F1 artifact 异常")} | ${mdEscape(issue.artifactPath)} |`);
  lines.push("", `- F1 artifact 目录：${mdEscape(report.artifactRoot)}`, "");
  return lines.join("\n");
}

export function renderF2Report(report) {
  if (report.status === "inputRejected") return renderRejected(report);
  const needsCorrection = report.status !== "completed";
  const lines = [
    "# Feature 2 数据检查报告", "", `- 工作簿：${mdEscape(report.workbook.fileName)}`, "", "## 执行摘要", "",
    "| 项目 | 结果 |", "|---|---|",
    `| 当前状态 | ${needsCorrection ? "需要修改 Excel" : "可继续"} |`,
    `| 工作表 | 共 ${report.summary.worksheetsChecked}；阻塞 ${report.summary.blockedWorksheetCount}；可继续 ${report.summary.readyWorksheetCount} |`,
    `| 必填缺失 | ${report.summary.rowsWithRequiredMissing} 个 factor；${report.summary.requiredMissingFieldCount} 个字段 |`,
    `| 截面图缺失 | ${report.summary.missingImageWorksheetCount} 个工作表 |`,
    `| 能力库 | 库内 ${report.summary.inLibraryCount}；库外 ${report.summary.outsideLibraryCount}；无法检查 ${report.summary.unableToCheckCount} |`,
    `| 非阻塞差异 | 公差 ${report.summary.toleranceDifferenceCount}；分布 ${report.summary.distributionDifferenceCount} |`,
    `| 标识符提醒 | DIM ID 缺失 ${report.summary.missingDimIdCount}；Part Number 缺失 ${report.summary.missingPartNumberCount} |`, "",
  ];
  if (needsCorrection) lines.push("请修正 TA Excel 源文件并重新运行 F1，再将新的 F1 输出目录提交给 F2。", "");

  lines.push("## 缺失字段统计", "", "| Worksheet | 缺失字段 | 影响 factor 数 | 源行 |", "|---|---|---:|---|");
  let missingCount = 0;
  for (const worksheet of report.worksheets) for (const summary of worksheet.missingFieldSummary) {
    missingCount += 1;
    lines.push(`| ${mdEscape(worksheet.worksheetName)} | ${mdEscape(fieldLabels[summary.field] ?? summary.field)} | ${summary.factorCount} | ${summary.sourceRows.length ? summary.sourceRows.join(", ") : "—"} |`);
  }
  if (missingCount === 0) lines.push("| — | 无 | 0 | — |");
  lines.push("", "## 增强 Raw Data", "");

  for (const worksheet of report.worksheets) {
    lines.push(`### ${mdEscape(worksheet.worksheetName)}`, "", `状态：${worksheet.status === "blocked" ? "需要修改" : "可继续"}；截面图：${worksheet.tolerancePathImageStatus === "available" ? "已提供" : "（缺失）"}`, "");
    lines.push("| Row | Factor Description | Part Name | Part Number | DIM ID | Part Category | Design Nominal | + Tolerance | - Tolerance | Long Term/Safety Factor | Sigma Level | Distribution | 能力库结果 | 知识库推荐 |", "|---:|---|---|---|---|---|---:|---:|---:|---:|---:|---|---|---|");
    for (const row of worksheet.rows) {
      const fields = row.displayedFields;
      lines.push(`| ${row.sourceRow} | ${mdEscape(fields.factorName)} | ${mdEscape(fields.partName)} | ${mdEscape(fields.partNumber)} | ${mdEscape(fields.dimCharacteristicId)} | ${mdEscape(fields.partCategory)} | ${mdEscape(fields.nominalValue)} | ${mdEscape(fields.upperTolerance)} | ${mdEscape(fields.lowerTolerance)} | ${mdEscape(fields.longTermSafetyFactor)} | ${mdEscape(fields.standardDeviation)} | ${mdEscape(fields.distribution)} | ${mdEscape(capabilityLabels[row.capabilityStatus] ?? row.capabilityStatus)} | ${mdEscape(recommendationText(row))} |`);
    }
    if (worksheet.rows.length === 0) lines.push("| — | — | — | — | — | — | — | — | — | — | — | — | 无 factor | — |");
    lines.push("");
  }

  lines.push("## 标识符提醒清单", "", "| Category | Worksheet | DIM ID 缺失 | Part Number 缺失 | Factor 行 | ADO 状态 |", "|---|---|---|---|---|---|");
  for (const event of report.adoEvents) lines.push(`| ${mdEscape(event.category)} | ${mdEscape(event.worksheetName)} | ${event.missingFields.includes("dimCharacteristicId") ? "是" : "否"} | ${event.missingFields.includes("partNumber") ? "是" : "否"} | ${event.factorRows.join(", ")} | 待触发 |`);
  if (report.adoEvents.length === 0) lines.push("| — | — | 否 | 否 | — | 无需触发 |");
  lines.push("", "## 技术追溯", "", `- Workbook hash：${report.workbook.contentHash}`, `- F1 generated at：${report.workbook.f1GeneratedAt}`, `- F0 version：${report.knowledgeBaseVersion}`, `- Mapping rule version：${report.mappingRuleVersion}`, `- F1 artifact 目录：${mdEscape(report.artifactRoot)}`, "");
  return lines.join("\n");
}