import path from "node:path";

function mdEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function actualValue(value) {
  return value === null || value === undefined ? "—" : mdEscape(value);
}

function fieldRawValue(row, fieldName) {
  const displayValue = row.displayFields?.[fieldName];
  return displayValue === null || displayValue === undefined || displayValue === ""
    ? row.actualFields[fieldName]
    : displayValue;
}

function fieldValue(row, fieldName) {
  return actualValue(fieldRawValue(row, fieldName));
}

function imageHref(artifactRoot, outputRoot, imageReference) {
  if (!imageReference) return undefined;
  return path.relative(path.resolve(outputRoot), path.resolve(artifactRoot, imageReference.relativePath)).split(path.sep).join("/");
}

function imageLink(value, href) {
  const label = actualValue(value);
  return href ? `[${label}](${href})` : label;
}

function specificationValue(evidence) {
  return evidence?.status === "available" ? mdEscape(evidence.displayValue) : "（缺失或无效）";
}

function specificationSource(evidence) {
  return evidence?.sourceCell ? mdEscape(evidence.sourceCell) : "—";
}

function specificationLabel(evidence) {
  return evidence?.status === "available" ? mdEscape(evidence.sourceLabel) : "（缺失或无效）";
}

const fieldLabels = { factorName: "Factor Description", partName: "Part Name", partCategory: "Part Category", nominalValue: "Design Nominal", upperTolerance: "+ Tolerance", lowerTolerance: "- Tolerance", longTermSafetyFactor: "Long Term/Safety Factor", standardDeviation: "Sigma Level", distribution: "Distribution", tolerancePathImage: "截面图" };
const capabilityLabels = { in_library_recommended: "F0 公共库-符合推荐", in_library_tolerance_outside: "F0 公共库-公差超出推荐", in_library_distribution_differs: "F0 公共库-分布不同", in_library_tolerance_and_distribution_differ: "F0 公共库-公差及分布不同", outside_library: "非 F0 制程分类", internal_within_guidance: "F0 内部指导-符合", internal_guidance_exceeded: "F0 内部指导-超出", f0_information_insufficient: "F0 信息不足", non_f0_process_category: "非 F0 制程分类", unable_to_check: "无法检查" };
const artifactIssueLabels = { root_json_missing: "缺少 F1 根 JSON", root_md_missing: "缺少 F1 根 Markdown", manifest_missing: "缺少 worksheet manifest", worksheet_json_missing: "缺少 worksheet JSON", worksheet_md_missing: "缺少 worksheet Markdown", workbook_identity_mismatch: "artifact 身份或内容不一致", image_missing: "缺少截面图文件", image_empty: "截面图文件为空", image_unsupported: "截面图格式不支持", path_outside_root: "artifact 路径越界", invalid_json: "JSON 无法解析", invalid_contract: "F1 artifact 格式不受支持" };

function recommendationText(row) {
  const value = row.recommendation;
  if (value?.kind === "internal-guidance") return `最大总公差带 ${value.maximumRecommendedTotalBand} ${value.unit} · internal-v1 · ${value.matchedEntryId}`;
  if (value?.kind === "public") return `${value.toleranceMin}–${value.toleranceMax} ${value.unit} / ${value.distribution} · v1 · ${value.capabilityEntryId}`;
  return "—";
}

function renderRejected(report) {
  const lines = ["# Feature 2 数据检查报告", "", "## F1 输出不完整", "", "F2 未开始业务检查。请补齐下列 F1 输出文件后重新运行。", "", "| 缺失或异常项目 | Artifact |", "|---|---|"];
  for (const issue of report.artifactIssues) lines.push(`| ${mdEscape(artifactIssueLabels[issue.reasonCode] ?? "F1 artifact 异常")} | ${mdEscape(issue.artifactPath)} |`);
  lines.push("", `- F1 artifact 目录：${mdEscape(report.artifactRoot)}`, "");
  return lines.join("\n");
}

export function renderF2Report(report, { outputRoot } = {}) {
  if (typeof outputRoot !== "string" || outputRoot.length === 0) throw new Error("F2 report outputRoot is required.");
  if (report.status === "inputRejected") return renderRejected(report);
  const needsCorrection = report.status !== "completed";
  const lines = [
    "# Feature 2 数据检查报告", "", `- 工作簿：${mdEscape(report.workbook.fileName)}`, "", "## 执行摘要", "",
    "| 项目 | 结果 |", "|---|---|",
    `| 当前状态 | ${needsCorrection ? "需要修改 Excel" : "可继续"} |`,
    `| 工作表 | 共 ${report.summary.worksheetsChecked}；阻塞 ${report.summary.blockedWorksheetCount}；可继续 ${report.summary.readyWorksheetCount} |`,
    `| 必填缺失 | ${report.summary.rowsWithRequiredMissing} 个 factor；${report.summary.requiredMissingFieldCount} 个字段 |`,
    `| 截面图缺失 | ${report.summary.missingImageWorksheetCount} 个工作表 |`,
    `| F0 内部指导 | 符合 ${report.summary.internalWithinGuidanceCount}；超出 ${report.summary.internalGuidanceExceededCount}；信息不足 ${report.summary.f0InformationInsufficientCount} |`,
    `| F0 公共库 | 命中 ${report.summary.publicLibraryMatchCount}；公差差异 ${report.summary.publicToleranceDifferenceCount}；分布差异 ${report.summary.publicDistributionDifferenceCount} |`,
    `| F0 未判断 | 非 F0 制程分类 ${report.summary.nonF0ProcessCategoryCount}；无法检查 ${report.summary.unableToCheckCount} |`,
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
    const specification = worksheet.systemSpecification;
    const handoff = report.f4Handoffs.find((candidate) => candidate.worksheetName === worksheet.worksheetName);
    lines.push("#### 系统规格", "", "| 规格 | 值 | Source cell |", "|---|---:|---|",
      `| ${specificationLabel(specification.designNominal)} | ${specificationValue(specification.designNominal)} | ${specificationSource(specification.designNominal)} |`,
      `| ${specificationLabel(specification.lowerSpecLimit)} | ${specificationValue(specification.lowerSpecLimit)} | ${specificationSource(specification.lowerSpecLimit)} |`,
      `| ${specificationLabel(specification.upperSpecLimit)} | ${specificationValue(specification.upperSpecLimit)} | ${specificationSource(specification.upperSpecLimit)} |`,
      `| ${specificationLabel(specification.targetSigmaLevel)} | ${specificationValue(specification.targetSigmaLevel)} | ${specificationSource(specification.targetSigmaLevel)} |`,
      `| ${specificationLabel(specification.additionalMeanShift)} | ${specificationValue(specification.additionalMeanShift)} | ${specificationSource(specification.additionalMeanShift)} |`,
      "",
      `规格校验：${worksheet.systemSpecificationIssues.length === 0 ? "通过" : "阻塞"}；${handoff ? `F4 handoff：${handoff.status}` : "未生成 F4 handoff"}`,
      "");
    lines.push("| Row | Factor Description | Part Name | Drawing Number | DIM ID | Part Category | Design Nominal | + Tolerance | - Tolerance | Long Term/Safety Factor | Sigma Level | Distribution | Mean | Tolerance | One Sigma | % Contribution to Sigma | Notes | 能力库结果 | 知识库推荐 |", "|---:|---|---|---|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|---|");
    for (const row of worksheet.rows) {
      const href = imageHref(report.artifactRoot, outputRoot, row.imageReference);
      lines.push(`| ${row.sourceRow} | ${imageLink(fieldRawValue(row, "factorName"), href)} | ${imageLink(fieldRawValue(row, "partName"), href)} | ${fieldValue(row, "drawingNumber")} | ${fieldValue(row, "dimCharacteristicId")} | ${fieldValue(row, "partCategory")} | ${fieldValue(row, "nominalValue")} | ${fieldValue(row, "upperTolerance")} | ${fieldValue(row, "lowerTolerance")} | ${fieldValue(row, "longTermSafetyFactor")} | ${fieldValue(row, "sigmaLevel")} | ${fieldValue(row, "distribution")} | ${fieldValue(row, "mean")} | ${fieldValue(row, "tolerance")} | ${fieldValue(row, "oneSigma")} | ${fieldValue(row, "percentContributionToSigma")} | ${fieldValue(row, "notes")} | ${mdEscape(capabilityLabels[row.capabilityStatus] ?? row.capabilityStatus)} | ${mdEscape(recommendationText(row))} |`);
    }
    if (worksheet.rows.length === 0) lines.push(`| ${Array.from({ length: 19 }, (_, index) => index === 17 ? "无 factor" : "—").join(" | ")} |`);
    lines.push("");
  }

  lines.push("## 标识符提醒清单", "", "| Category | Worksheet | DIM ID 缺失 | Part Number 缺失 | Factor 行 | ADO 状态 |", "|---|---|---|---|---|---|");
  for (const event of report.adoEvents) lines.push(`| ${mdEscape(event.category)} | ${mdEscape(event.worksheetName)} | ${event.missingFields.includes("dimCharacteristicId") ? "是" : "否"} | ${event.missingFields.includes("partNumber") ? "是" : "否"} | ${event.factorRows.join(", ")} | 待触发 |`);
  if (report.adoEvents.length === 0) lines.push("| — | — | 否 | 否 | — | 无需触发 |");
  lines.push("", "## 技术追溯", "", `- Workbook hash：${report.workbook.contentHash}`, `- F1 generated at：${report.workbook.f1GeneratedAt}`, `- F0 versions：${report.knowledgeBaseVersions.join(", ")}`, `- Mapping rule version：${report.mappingRuleVersion}`, `- F1 artifact 目录：${mdEscape(report.artifactRoot)}`, "");
  return lines.join("\n");
}