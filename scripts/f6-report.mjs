import { f6LegacyOptimizationResultSchema, f6OptimizationResultSchema } from "../packages/contracts/dist/contracts.js";
import { cell } from "./f6-markdown-sanitizer.mjs";
import { evidenceLabel, formatEngineering, formatPercent } from "./engineering-format.mjs";

function optionName(kind) {
  return {
    reduce_top_contributor_20: "Reduce Top Contributor 20%",
    reduce_top_3_contributors_30: "Reduce Top 3 Contributors 30%",
    mean_shift_centering: "Mean Shift Centering",
    reverse_solve_single_factor: "Reverse Solve Single Factor",
    reverse_solve_top_3: "Reverse Solve Top 3",
    rss_apportionment: "RSS Apportionment",
    centering_plus_tighten: "Centering Plus Tighten",
    improve_supplier_capability: "Improve Supplier Capability",
    tighten_datum_strategy: "Tighten Datum Strategy",
    requirement_change: "Requirement Change",
  }[kind] ?? kind;
}

function optionResult(option) {
  if (option.status === "completed") {
    return `Cpk ${option.resultMetrics.cpk}; delta Cpk ${option.deltaCpk}; feasibility ${option.feasibility.status}`;
  }
  if (option.status === "insufficient_evidence") {
    return `insufficient_evidence; required inputs: ${option.requiredInputs.join(", ")}`;
  }
  return `calculation_failed; reason: ${option.reasonCode}`;
}

function capabilityStatus(worksheet) {
  if (worksheet.baselineMetrics.cpk < 1) return "FAIL";
  if (worksheet.inputFindings.some(({ findingKind }) => findingKind === "confirmed_requirement_violation")) return "FAIL";
  if (worksheet.inputFindings.some(({ affectsCapabilityData }) => affectsCapabilityData)) return "RISK";
  if (worksheet.baselineMetrics.cpk < worksheet.targetCapability.targetCpk) return "RISK";
  return "PASS";
}

function renderReadyWorksheet(lines, worksheet) {
  const baselineCapabilityStatus = capabilityStatus(worksheet);
  lines.push(
    `## Worksheet: ${cell(worksheet.worksheetName)}`,
    "",
    "### Executive Summary",
    "",
    `- Capability Status: ${baselineCapabilityStatus}`,
    `- Optimization Status: ${cell(worksheet.status)}`,
    `- Target Cpk: ${worksheet.targetCapability.targetCpk} (${cell(worksheet.targetCapability.source)})`,
    `- Highest Impact Action: ${cell(worksheet.highestImpactAction?.optionId ?? "insufficient_evidence")}`,
    `- ROI: ${cell(worksheet.roiStatus)}`,
    "",
    "### Capability",
    "",
    "| Metric | Result | Status |",
    "|---|---:|---|",
    `| Mean | ${worksheet.baselineMetrics.mean} | baseline |`,
    `| Sigma | ${worksheet.baselineMetrics.rssSigma} | baseline |`,
    `| Cp | ${worksheet.baselineMetrics.cp} | baseline |`,
    `| Cpk | ${worksheet.baselineMetrics.cpk} | ${baselineCapabilityStatus} |`,
    `| Yield | ${worksheet.baselineMetrics.yield} | baseline |`,
    `| DPMO | ${worksheet.baselineMetrics.dpm} | baseline |`,
    "",
    "### Risk Assessment",
    "",
    "| Risk Area | Rating | Reason |",
    "|---|---|---|",
  );
  if (worksheet.risks.length === 0) lines.push("| — | — | No governed risks recorded. |");
  for (const risk of worksheet.risks) {
    lines.push(`| ${cell(risk.category)} | ${cell(risk.rating)} | ${cell(`${risk.status}: ${risk.reason}`)} |`);
  }
  lines.push(
    "",
    "### Options",
    "",
    "| Scenario | Predicted Improvement |",
    "|---|---|",
  );
  for (const option of worksheet.options) {
    lines.push(`| ${cell(optionName(option.optionKind))} | ${cell(optionResult(option))} |`);
  }
  lines.push("", "### Recommendations", "");
  if (worksheet.recommendations.length === 0) lines.push("- No supported verified option recommendation is available.");
  for (const recommendation of worksheet.recommendations) {
    lines.push(`- ${cell(recommendation.text)}${recommendation.optionId === undefined ? "" : ` (option: ${cell(recommendation.optionId)})`}`);
  }
  for (const clarification of worksheet.clarifications) {
    lines.push(`- Evidence closure ${cell(clarification.clarificationId)}: ${cell(clarification.questionForReviewer)} Required inputs: ${cell(clarification.requiredInputs.join(", "))}.`);
  }
}

function renderRejectedWorksheet(lines, worksheet) {
  lines.push(
    `## Worksheet: ${cell(worksheet.worksheetName)}`,
    "",
    "### Input Validation",
    "",
  );
  for (const finding of worksheet.inputFindings) {
    lines.push(`- ${cell(finding.severity)}: ${cell(finding.message)}`);
  }
}

export function renderLegacyF6Report(result, options = {}) {
  void options;
  let parsed;
  try {
    parsed = f6LegacyOptimizationResultSchema.parse(result);
  } catch {
    throw new Error("Invalid F6 result.");
  }
  const lines = [
    "# Feature 6 优化工程报告",
    "",
    "## Workbook Executive Summary",
    "",
    `- Optimization Status: ${cell(parsed.status)}`,
    `- Workbook: ${cell(parsed.workbook.fileName)}`,
    `- Worksheets: ${parsed.summary.worksheetCount}`,
    `- Completed options: ${parsed.summary.completedOptionCount}`,
  ];
  for (const worksheet of parsed.worksheets) {
    lines.push("");
    if (worksheet.status === "input_rejected") renderRejectedWorksheet(lines, worksheet);
    else renderReadyWorksheet(lines, worksheet);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderV2Option(lines, option) {
  if (option.status === "candidate") {
    lines.push(
      `| ${cell(option.optionId)} | 候选项 | ${evidenceLabel("MISSING")} 未提供受控优化目标 | ${cell(option.requiredInputs.join(", "))} |`,
    );
    return;
  }
  if (option.status === "completed") {
    lines.push(
      `| ${cell(option.optionId)} | 已重算 | Cpk ${option.resultMetrics.cpk.toFixed(3)} ratio；RSS ${formatEngineering(option.resultMetrics.rssSigma, "mm", 3)} | ${cell(option.feasibility.status)} |`,
    );
    return;
  }
  if (option.status === "insufficient_evidence") {
    lines.push(`| ${cell(option.optionId)} | 证据不足 | ${evidenceLabel("MISSING")} | ${cell(option.requiredInputs.join(", "))} |`);
    return;
  }
  lines.push(`| ${cell(option.optionId)} | 计算失败 | 无量化结果 | ${cell(option.reasonCode)} |`);
}

export function renderF6Report(result, options = {}) {
  void options;
  let parsed;
  try {
    parsed = f6OptimizationResultSchema.parse(result);
  } catch {
    throw new Error("Invalid F6 result.");
  }
  const lines = [
    "# Feature 6 公差优化报告 V2",
    "",
    "## Workbook 执行摘要",
    "",
    `- 运行状态：${cell(parsed.runStatus)}`,
    `- Workbook：${cell(parsed.workbook.fileName)}`,
    `- Worksheet 数量：${parsed.summary.worksheetCount}`,
    `- 已完成量化方案：${parsed.summary.completedOptionCount}`,
    `- 候选方案：${parsed.summary.candidateOptionCount}`,
  ];
  for (const worksheet of parsed.worksheets) {
    const metrics = worksheet.baselineMetrics;
    lines.push(
      "",
      `## Worksheet：${cell(worksheet.worksheetName)}`,
      "",
      "### 1. Baseline 计算",
      "",
      `- ${evidenceLabel("CALCULATED")} Mean：${formatEngineering(metrics.mean, "mm", 3)}`,
      `- ${evidenceLabel("CALCULATED")} RSS 1σ：${formatEngineering(metrics.rssSigma, "mm", 3)}`,
      `- ${evidenceLabel("CALCULATED")} Worst Case 下限：${formatEngineering(metrics.worstCaseLower, "mm", 3)}`,
      `- ${evidenceLabel("CALCULATED")} Worst Case 上限：${formatEngineering(metrics.worstCaseUpper, "mm", 3)}`,
      `- 预测性能力指标 Cpk：${metrics.cpk.toFixed(3)} ratio` ,
      `- 模型预测 Yield：${metrics.yield === null ? "不适用" : formatPercent(metrics.yield * 100, 2)}`,
      "- 限制：上述 Cpk/Yield 来自设计公差模型，不等同于实测量产能力。",
      "",
      "### 2. Optimization Targets 与重算结果",
      "",
      "| Option ID | 状态 | 结果 | 限制/所需输入 |",
      "|---|---|---|---|",
    );
    for (const option of worksheet.options) renderV2Option(lines, option);
    lines.push(
      "",
      `- Highest Impact Action：${worksheet.highestImpactAction === null ? "未提供受支持的量化方案" : cell(worksheet.highestImpactAction.optionId)}`,
      `- Optimization Targets decision：${cell(parsed.provenance.optimizationTargetsDecision.outcome)}`,
      `- Analysis Context decision：${cell(parsed.provenance.analysisContextDecision.outcome)}`,
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
