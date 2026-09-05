import { f6LegacyOptimizationResultSchema, f6OptimizationResultSchema } from "../packages/contracts/dist/contracts.js";
import { cell } from "./f6-markdown-sanitizer.mjs";
import { evidenceLabel, formatEngineering, formatPercent } from "./engineering-format.mjs";

const RECOMMENDATION_CLASS_ORDER = [
  "factor_nominal",
  "system_mean_shift",
  "system_specification",
  "factor_tolerance",
];

const CLARIFICATION_REASON_CODES_BY_CLASS = {
  factor_nominal: new Set([
    "factor_nominal_target_required",
    "model_factor_nominal_insufficient_evidence",
    "model_factor_nominal_deterministic_target_unavailable",
  ]),
  system_mean_shift: new Set([
    "system_mean_shift_target_required",
    "model_system_mean_shift_insufficient_evidence",
    "model_system_mean_shift_deterministic_target_unavailable",
  ]),
  system_specification: new Set([
    "system_specification_target_required",
    "model_system_specification_insufficient_evidence",
    "model_system_specification_deterministic_target_unavailable",
    "optimization_target_required",
  ]),
  factor_tolerance: new Set([
    "factor_tolerance_target_required",
    "model_factor_tolerance_insufficient_evidence",
    "model_factor_tolerance_deterministic_target_unavailable",
  ]),
};

const CLARIFICATION_REQUIRED_INPUTS_BY_CLASS = {
  factor_nominal: new Set(["factor_nominal_target"]),
  system_mean_shift: new Set(["system_mean_shift_target"]),
  system_specification: new Set(["system_specification_target"]),
  factor_tolerance: new Set(["factor_tolerance_target"]),
};

function hasClassRequiredInput(item, adjustmentClass) {
  const expected = CLARIFICATION_REQUIRED_INPUTS_BY_CLASS[adjustmentClass];
  if (expected === undefined || !Array.isArray(item.requiredInputs)) return false;
  return item.requiredInputs.some((input) => expected.has(String(input)));
}

function optionClass(option) {
  if (option.optionSource === "BUILT_IN_POLICY") return "factor_tolerance";
  if (option.targetContext?.targetType === "factor_nominal") return "factor_nominal";
  if (option.targetContext?.targetType === "system_mean_shift") return "system_mean_shift";
  if (option.targetContext?.targetType === "system_specification") return "system_specification";
  return "factor_tolerance";
}

function classClarifications(worksheet, adjustmentClass) {
  return worksheet.clarifications.filter((item) => {
    const reasonCode = String(item.reasonCode ?? "");
    const allowedReasonCodes = CLARIFICATION_REASON_CODES_BY_CLASS[adjustmentClass];
    if (allowedReasonCodes?.has(reasonCode)) return true;
    return hasClassRequiredInput(item, adjustmentClass);
  });
}

function clarificationReasonCode(item, adjustmentClass) {
  const reasonCode = String(item.reasonCode ?? "");
  if (adjustmentClass === "system_specification" && reasonCode === "optimization_target_required") {
    return "system_specification_target_required";
  }
  return reasonCode;
}

function optionValueSummary(option) {
  if (option.status !== "completed") return option.status;
  const baseline = option.baselineMetrics;
  const result = option.resultMetrics;
  return `Cpk ${result.cpk.toFixed(3)} (Δ${(result.cpk - baseline.cpk).toFixed(3)}); RSS ${result.rssSigma.toFixed(6)} (Δ${(result.rssSigma - baseline.rssSigma).toFixed(6)})`;
}

function classGovernanceNote(adjustmentClass) {
  if (adjustmentClass === "system_specification") {
    return "Requirement Change; caller authorization and ME review required; no automatic change.";
  }
  return "Deterministic scenario evidence only; model narrative cannot override numeric truth.";
}

function renderRecommendationBasis(lines, worksheet) {
  lines.push(
    "",
    "### 3. 建议依据",
    "",
    "| Adjustment Class | Deterministic Option Evidence | Clarifications | Governance Note |",
    "|---|---|---|---|",
  );
  for (const adjustmentClass of RECOMMENDATION_CLASS_ORDER) {
    const options = worksheet.options.filter((option) => optionClass(option) === adjustmentClass);
    const optionText = options.length === 0
      ? "No deterministic scenario executed."
      : options.map((option) => `${option.optionId}: ${optionValueSummary(option)}`).join("; ");
    const clarifications = classClarifications(worksheet, adjustmentClass);
    const clarificationText = clarifications.length === 0
      ? "None"
      : clarifications.map((item) => clarificationReasonCode(item, adjustmentClass)).join("; ");
    lines.push(`| ${cell(adjustmentClass)} | ${cell(optionText)} | ${cell(clarificationText)} | ${cell(classGovernanceNote(adjustmentClass))} |`);
  }
}

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

function v2TargetLabel(option) {
  if (option.policyContext !== undefined) {
    return `${option.policyContext.policyId} (${option.policyContext.optionCode})`;
  }
  if (option.targetContext === undefined) return option.targetId ?? option.optionId;
  if (option.targetContext.targetType === "system_target") {
    return `${option.targetContext.targetId} (${option.targetContext.targetType}; ${option.targetContext.apportionment.policy})`;
  }
  return `${option.targetContext.targetId} (${option.targetContext.targetType})`;
}

function v2AdjustedLabel(option) {
  const overrides = option.scenarioEvidence?.factorOverrides ?? [];
  if (overrides.length === 0) return "n/a";
  return overrides.map((override) => {
    const upper = override.upperTolerance === undefined ? "n/a" : formatEngineering(override.upperTolerance, override.factor.unit, 3);
    const lower = override.lowerTolerance === undefined ? "n/a" : formatEngineering(override.lowerTolerance, override.factor.unit, 3);
    return `${override.factor.factorName}: +Tol ${upper} / -Tol ${lower}`;
  }).join("; ");
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
    const targetSigmaLevel = worksheet.targetCapability.targetSigmaLevel;
    const rssLower = metrics.mean - targetSigmaLevel * metrics.rssSigma;
    const rssUpper = metrics.mean + targetSigmaLevel * metrics.rssSigma;
    const worstCaseLower = metrics.mean + metrics.worstCaseLower;
    const worstCaseUpper = metrics.mean + metrics.worstCaseUpper;
    lines.push(
      "",
      `## Worksheet：${cell(worksheet.worksheetName)}`,
      "",
      "### 1. Baseline 计算",
      "",
      `- ${evidenceLabel("CALCULATED")} Mean：${formatEngineering(metrics.mean, "mm", 3)}`,
      `- ${evidenceLabel("CALCULATED")} RSS 1σ：${formatEngineering(metrics.rssSigma, "mm", 3)}`,
      `- ${evidenceLabel("CALCULATED")} RSS ${targetSigmaLevel}σ 范围：${formatEngineering(rssLower, "mm", 3)} ～ ${formatEngineering(rssUpper, "mm", 3)}`,
      `- ${evidenceLabel("CALCULATED")} Worst Case 绝对范围：${formatEngineering(worstCaseLower, "mm", 3)} ～ ${formatEngineering(worstCaseUpper, "mm", 3)}`,
      `- 预测性能力指标 Cpk：${metrics.cpk.toFixed(3)} ratio` ,
      `- 模型预测 Yield：${metrics.yield === null ? "不适用" : formatPercent(metrics.yield * 100, 2)}`,
      "- 限制：上述 Cpk/Yield 来自设计公差模型，不等同于实测量产能力。",
      "",
      "### 2. Optimization Targets 与重算结果",
      "",
    );
    const completedOptions = worksheet.options.filter((option) => option.status === "completed");
    if (completedOptions.length > 0) {
      lines.push(
        "| Scenario | Target | Baseline vs Adjusted | RSS/Cpk/Margin/Yield | Delta |",
        "|---|---|---|---|---|",
      );
      for (const option of completedOptions) {
        const baseline = option.baselineMetrics;
        const resultMetrics = option.resultMetrics;
        const baselineYield = baseline.yield === null ? "n/a" : formatPercent(baseline.yield * 100, 2);
        const scenarioYield = resultMetrics.yield === null ? "n/a" : formatPercent(resultMetrics.yield * 100, 2);
        const deltaYield = baseline.yield === null || resultMetrics.yield === null ? "n/a" : Number(resultMetrics.yield - baseline.yield).toFixed(6);
        lines.push(`| ${cell(option.optionId)} | ${cell(v2TargetLabel(option))} | ${cell(`baseline unavailable in optimization artifact; adjusted ${v2AdjustedLabel(option)}`)} | ${cell(`RSS ${resultMetrics.rssSigma.toFixed(6)}; Cpk ${resultMetrics.cpk.toFixed(3)}; Margin n/a; Yield ${scenarioYield}`)} | ${cell(`ΔRSS ${(resultMetrics.rssSigma - baseline.rssSigma).toFixed(6)}; ΔCpk ${(resultMetrics.cpk - baseline.cpk).toFixed(3)}; ΔMargin n/a; ΔYield ${deltaYield}`)} |`);
        lines.push(`|  |  |  | ${cell(`Baseline RSS ${baseline.rssSigma.toFixed(6)}; Baseline Cpk ${baseline.cpk.toFixed(3)}; Baseline Yield ${baselineYield}`)} |  |`);
      }
    } else {
      lines.push(
        "| Option ID | 状态 | 结果 | 限制/所需输入 |",
        "|---|---|---|---|",
      );
      for (const option of worksheet.options) renderV2Option(lines, option);
    }
    lines.push(
      "",
      `- Highest Impact Action：${worksheet.highestImpactAction === null ? "未提供受支持的量化方案" : cell(worksheet.highestImpactAction.optionId)}`,
      `- Optimization Targets decision：${cell(parsed.provenance.optimizationTargetsDecision.outcome)}`,
      `- Analysis Context decision：${cell(parsed.provenance.analysisContextDecision.outcome)}`,
      `- Model Interpretation decision：${cell(parsed.provenance.modelInterpretationDecision?.outcome ?? "NOT_PROVIDED")}`,
    );
    renderRecommendationBasis(lines, worksheet);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
