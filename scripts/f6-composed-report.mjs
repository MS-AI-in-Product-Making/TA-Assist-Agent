import { f6ComposedEngineeringReportSchema, f6LegacyComposedEngineeringReportSchema } from "../packages/contracts/dist/contracts.js";
import { cell } from "./f6-markdown-sanitizer.mjs";
import { evidenceLabel, formatEngineering, formatPercent } from "./engineering-format.mjs";

function scenarioName(kind) {
  return {
    reduce_top_contributor_20: "Reduce Top Contributor 20%",
    reduce_top_3_contributors_30: "Reduce Top 3 Contributors 30%",
    improve_supplier_capability: "Improve Supplier Capability",
    tighten_datum_strategy: "Tighten Datum Strategy",
  }[kind] ?? kind;
}

function predictedImprovement(option) {
  if (option.status === "completed") return `${option.predictedImprovement}; ${option.summary}`;
  if (option.status === "insufficient_evidence") {
    return `insufficient_evidence; required inputs: ${option.requiredInputs.join(", ")}`;
  }
  return `calculation_failed; reason: ${option.reasonCode}`;
}

function renderWorkbook(lines, report) {
  lines.push("## Workbook Executive Summary", "");
  for (const bullet of report.workbookExecutiveSummary) lines.push(`- ${cell(bullet)}`);
  lines.push("", "## Workbook Input Validation", "", "| Item | Value |", "|---|---|");
  if (report.blockedWorksheets.length === 0) lines.push("| Blocked Worksheets | None | ");
  for (const worksheet of report.blockedWorksheets) {
    for (const finding of worksheet.findings) {
      lines.push(`| ${cell(worksheet.worksheetName)} | ${cell(`${finding.severity}: ${finding.findingCode}; ${finding.message}`)} |`);
    }
  }
}

function renderExecutiveSummary(lines, section) {
  lines.push("### Executive Summary", "");
  for (const bullet of section) lines.push(`- ${cell(bullet)}`);
}

function renderRequirementReview(lines, section) {
  lines.push(
    "### Requirement Review",
    "",
    "| Item | Value |",
    "|---|---|",
    `| CTQ | ${cell(section.ctq)} |`,
    `| Nominal | ${section.nominal} |`,
    `| LSL | ${section.lowerSpecLimit} |`,
    `| USL | ${section.upperSpecLimit} |`,
    `| Spec Width | ${section.specWidth} |`,
    `| Assessment | ${cell(section.assessment)} |`,
    `| Risk Level | ${cell(section.riskLevel)} |`,
  );
}

function renderInputValidation(lines, findings) {
  lines.push("### Input Validation", "", "| Item | Value |", "|---|---|");
  if (findings.length === 0) lines.push("| Findings | None | ");
  for (const finding of findings) {
    lines.push(`| ${cell(finding.findingCode)} | ${cell(`${finding.severity}: ${finding.message}`)} |`);
  }
}

function renderCapability(lines, section, worksheetStatus) {
  lines.push(
    "### Capability Assessment",
    "",
    "| Metric | Result | Status |",
    "|---|---:|---|",
    `| Mean | ${section.metrics.mean} | reported |`,
    `| Sigma | ${section.metrics.rssSigma} | reported |`,
    `| Cp | ${section.metrics.cp} | reported |`,
    `| Cpk | ${section.metrics.cpk} | ${cell(worksheetStatus)} |`,
    `| Yield | ${section.metrics.yield} | reported |`,
    `| DPMO | ${section.metrics.dpm} | reported |`,
    `| OOS Rate | ${section.oosRate} | reported |`,
    `| OOS ppm | ${section.oosPpm} | reported |`,
  );
  for (const finding of section.findings) lines.push(`- ${cell(finding)}`);
}

function renderContributors(lines, section) {
  lines.push(
    "### Contributor Analysis",
    "",
    "| Rank | Contributor | Contribution |",
    "|---:|---|---:|",
  );
  for (const [index, contributor] of section.topContributors.entries()) {
    lines.push(`| ${index + 1} | ${cell(contributor.factorName)} | ${contributor.contributionPercent}% |`);
  }
  if (section.topContributors.length === 0) lines.push("| — | insufficient_evidence | — | ");
  lines.push(
    "",
    `- Top 1 concentration: ${section.top1Concentration}%`,
    `- Top 3 concentration: ${section.top3Concentration}%`,
    `- Assessment: ${cell(section.concentrationAssessment)} (${cell(section.policyVersion)})`,
  );
}

function renderRootCause(lines, section) {
  lines.push("### Root Cause Analysis", "", `- Evidence status: ${cell(section.evidenceStatus)}`);
  for (const finding of section.factBasedFindings) lines.push(`- ${cell(finding)}`);
  for (const finding of section.ruleFindings) lines.push(`- ${cell(finding)}`);
  for (const finding of section.optionFindings) lines.push(`- ${cell(finding)}`);
  for (const signal of section.signals) lines.push(`- ${cell(signal)}`);
}

function renderRisks(lines, risks) {
  lines.push(
    "### Risk Assessment",
    "",
    "| Risk Area | Rating | Reason |",
    "|---|---|---|",
  );
  if (risks.length === 0) lines.push("| — | — | No governed risks recorded. | ");
  for (const risk of risks) {
    lines.push(`| ${cell(risk.category)} | ${cell(risk.rating)} | ${cell(`${risk.status}: ${risk.reason}`)} |`);
  }
}

function renderRecommendations(lines, recommendations) {
  lines.push(
    "### Recommendations",
    "",
    "| Priority | Recommendation | Expected Benefit |",
    "|---:|---|---|",
  );
  if (recommendations.length === 0) lines.push("| — | No supported recommendation | insufficient_evidence | ");
  for (const [index, recommendation] of recommendations.entries()) {
    const reference = recommendation.kind === "verified_option"
      ? `option:${recommendation.optionId}`
      : `clarification:${recommendation.clarificationId}`;
    lines.push(`| ${index + 1} | ${cell(`[${recommendation.recommendationId}] [${reference}] ${recommendation.text}`)} | ${cell(recommendation.expectedBenefit)} |`);
  }
}

function renderWhatIf(lines, section) {
  lines.push(
    "### What-If Analysis",
    "",
    "| Scenario | Predicted Improvement |",
    "|---|---|",
  );
  for (const option of section.options) {
    lines.push(`| ${cell(scenarioName(option.optionKind))} | ${cell(predictedImprovement(option))} |`);
  }
  lines.push(
    "",
    `- ${cell(section.highestImpactAction)}`,
    `- ROI: ${cell(section.roiStatus)}`,
  );
}

function renderFinalConclusion(lines, section) {
  lines.push("### Final Conclusion", "");
  for (const bullet of section) lines.push(`- ${cell(bullet)}`);
}

function renderWorksheet(lines, worksheet) {
  const sections = worksheet.sections;
  lines.push("", `## Worksheet: ${cell(worksheet.worksheetName)}`, "");
  renderExecutiveSummary(lines, sections.executiveSummary);
  lines.push("");
  renderRequirementReview(lines, sections.requirementReview);
  lines.push("");
  renderInputValidation(lines, sections.inputValidation);
  lines.push("");
  renderCapability(lines, sections.capabilityAssessment, worksheet.status);
  lines.push("");
  renderContributors(lines, sections.contributorAnalysis);
  lines.push("");
  renderRootCause(lines, sections.rootCauseAnalysis);
  lines.push("");
  renderRisks(lines, sections.riskAssessment);
  lines.push("");
  renderRecommendations(lines, sections.recommendations);
  lines.push("");
  renderWhatIf(lines, sections.whatIfAnalysis);
  lines.push("");
  renderFinalConclusion(lines, sections.finalConclusion);
}

export function renderLegacyComposedEngineeringReport(report, options = {}) {
  void options;
  let parsed;
  try {
    parsed = f6LegacyComposedEngineeringReportSchema.parse(report);
  } catch {
    throw new Error("Invalid F6 composed engineering report.");
  }
  const lines = ["# F5 + F6 联合工程报告", ""];
  renderWorkbook(lines, parsed);
  for (const worksheet of parsed.worksheets) renderWorksheet(lines, worksheet);
  return `${lines.join("\n").trimEnd()}\n`;
}

function quantityText(quantity, decimals = 3) {
  return quantity === null ? "未提供" : formatEngineering(quantity.value, quantity.unit, decimals);
}

function rangeText(range, decimals = 3) {
  return range === null ? "未提供" : `${range.lower.toFixed(decimals)} ～ ${range.upper.toFixed(decimals)} ${range.unit}`;
}

function signedNumber(value, decimals = 6) {
  return Number(value).toFixed(decimals).replace(/\.0+$|(?<=\.[0-9]*?)0+$/u, "");
}

function formulaInput(formula, name) {
  return formula.inputs.find((input) => input.name === name);
}

function marginResult(minimumMargin) {
  return minimumMargin >= 0 ? "PASS" : "FAIL";
}

function findFormula(formulas, outputField, formulaId) {
  return formulas.find((formula) => formula.outputField === outputField)
    ?? formulas.find((formula) => formula.formulaId === formulaId)
    ?? null;
}

function pushSection(lines, number, title) {
  lines.push("", `## ${number}. ${title}`, "");
}

function renderWorksheetV2(lines, worksheet) {
  const sections = worksheet.sections;
  lines.push("", `# Worksheet：${cell(worksheet.worksheetName)}`, "");
  pushSection(lines, 1, "执行摘要 Executive Summary");
  lines.push(
    `- 最终判定：${cell(worksheet.status)}`,
    `- 分析对象：${cell(sections.executiveSummary.analysisObject ?? "未提供")}`,
    `- Mean Response：${quantityText(sections.executiveSummary.mean)}`,
    `- RSS 1σ：${quantityText(sections.executiveSummary.rssSigma)}`,
    `- 统计范围：${rangeText(sections.executiveSummary.statisticalRange)}`,
    `- Worst Case范围：${rangeText(sections.executiveSummary.worstCaseRange)}`,
    `- Minimum Margin：${quantityText(sections.executiveSummary.minimumMargin)}`,
    `- 预测性能力指标 Cpk：${sections.executiveSummary.predictiveCpk?.toFixed(3) ?? "未提供"} ratio`,
  );
  pushSection(lines, 2, "分析目标与功能要求");
  const objective = sections.objectiveAndRequirements;
  lines.push(`- 分析对象：${cell(objective.analysisObject?.name ?? "未提供")}`, `- Target：${quantityText(objective.target)}`, `- LSL：${quantityText(objective.lsl)}`, `- USL：${quantityText(objective.usl)}`, `- Target Cpk：${objective.targetCpk?.toFixed(3) ?? "未提供"} ratio`);
  pushSection(lines, 3, "分析工况与适用边界");
  if (sections.operatingConditions.conditions.length === 0) lines.push(`- ${evidenceLabel("MISSING")} 未提供受控工况。`);
  for (const condition of sections.operatingConditions.conditions) lines.push(`- ${cell(condition.category)}：${cell(condition.description)}`);
  pushSection(lines, 4, "输入数据与完整性检查");
  lines.push(`- 完整性评级：${cell(sections.inputIntegrity.rating)}`, "", "| Factor | Mean | +Tol | -Tol | Distribution | 1σ | Confidence |", "|---|---:|---:|---:|---|---:|---|");
  for (const factor of sections.inputIntegrity.factors) lines.push(`| ${cell(factor.factor.factorName)} | ${quantityText(factor.mean)} | ${quantityText(factor.upperTolerance)} | ${quantityText(factor.lowerTolerance)} | ${cell(factor.distribution)} | ${quantityText(factor.sigma)} | ${cell(factor.confidence)} |`);
  pushSection(lines, 5, "公差链定义 Tolerance Loop Definition");
  lines.push(`- Loop起点：${cell(sections.toleranceLoopDefinition.start ?? "未提供")}`, `- Loop终点：${cell(sections.toleranceLoopDefinition.end ?? "未提供")}`, `- 完整公式：${cell(sections.toleranceLoopDefinition.equation ?? "Loop方向待工程师确认")}`);
  pushSection(lines, 6, "Loop 一致性与计算自检");
  for (const check of [sections.calculationSelfCheck.meanCheck, sections.calculationSelfCheck.rssCheck, sections.calculationSelfCheck.worstCaseCheck].filter(Boolean)) lines.push(`- ${cell(check.checkId)}：${cell(check.result)}；Difference ${quantityText(check.difference)}；Tolerance ${quantityText(check.tolerance)}`);
  pushSection(lines, 7, "统计分析结果");
  const stats = sections.statisticalResults;
  lines.push(`- ${evidenceLabel("CALCULATED")} Mean：${quantityText(stats.mean)}`, `- RSS 1σ：${quantityText(stats.rssSigma)}`, `- Worst Case：${rangeText(stats.worstCase)}`);
  const targetRange = stats.ranges[0] ?? null;
  if (targetRange) {
    const sigmaLevel = targetRange.sigmaLevel;
    const statisticalFormula = findFormula(stats.formulaChecks, targetRange.formulaCheckId, targetRange.formulaCheckId);
    lines.push(`- Target ${sigmaLevel}σ statistical range：${rangeText(targetRange.range)}`);
    if (statisticalFormula) {
      const meanInput = formulaInput(statisticalFormula, "Mean");
      const rssInput = formulaInput(statisticalFormula, "RSS 1σ");
      if (meanInput && rssInput) {
        lines.push(
          `- Formula：Mean ± ${sigmaLevel} × RSS 1σ`,
          `- Substitution：Mean ± ${sigmaLevel} × RSS 1σ = ${signedNumber(meanInput.value)} ± ${sigmaLevel} × ${signedNumber(rssInput.value)} = ${signedNumber(targetRange.range.lower)} ～ ${signedNumber(targetRange.range.upper)} ${targetRange.range.unit}`,
        );
      }
    }
  }
  pushSection(lines, 8, "规格符合性与 Margin 评估");
  const margin = sections.specificationAndMargins.assessment;
  const specification = sections.specificationAndMargins.specification;
  const targetSigmaLevel = targetRange?.sigmaLevel ?? margin.statistical.sigmaLevel;
  lines.push(
    `- LSL：${quantityText(specification.lsl)}；USL：${quantityText(specification.usl)}；Target Cpk：${specification.targetCpk.toFixed(3)} ratio`,
    `- Target ${targetSigmaLevel}σ Minimum Margin：${signedNumber(margin.statistical.minimumMargin, 3)} ${specification.lsl.unit} (${marginResult(margin.statistical.minimumMargin)})`,
    `- Worst Case Margin：${signedNumber(margin.worstCase.lowerMargin, 3)} / ${signedNumber(margin.worstCase.upperMargin, 3)} ${specification.lsl.unit}`,
    `- Worst-case Minimum Margin：${signedNumber(margin.worstCase.minimumMargin, 3)} ${specification.lsl.unit} (${marginResult(margin.worstCase.minimumMargin)})`,
    "- 负值表示评估范围超出 Spec。",
  );
  pushSection(lines, 9, "制程能力评估 Capability Assessment");
  const capability = sections.capabilityAssessment;
  const lowerCpkFormula = findFormula(stats.formulaChecks, "capability.lowerCpk", "cpk-lower-v1");
  const upperCpkFormula = findFormula(stats.formulaChecks, "capability.upperCpk", "cpk-upper-v1");
  const cpkFormula = findFormula(stats.formulaChecks, "capability.cpk", "cpk-v1");
  lines.push(
    `- 能力基础：${capability.basis}`,
    `- Cp：${capability.cp.toFixed(3)} ratio`,
    `- Cpk：${capability.cpk.toFixed(3)} ratio`,
    `- Target Cpk：${capability.targetCpk.toFixed(3)} ratio`,
    `- 模型预测 Yield：${capability.predictedYield === null ? "不适用" : formatPercent(capability.predictedYield * 100, 2)}`,
    "- 说明：该 Cpk 基于公差预测模型，不是量产实测 Cpk。",
  );
  if (lowerCpkFormula && upperCpkFormula && cpkFormula) {
    const lowerMean = formulaInput(lowerCpkFormula, "Mean");
    const lowerLsl = formulaInput(lowerCpkFormula, "LSL");
    const lowerRss = formulaInput(lowerCpkFormula, "RSS 1σ");
    const upperUsl = formulaInput(upperCpkFormula, "USL");
    const upperMean = formulaInput(upperCpkFormula, "Mean");
    const upperRss = formulaInput(upperCpkFormula, "RSS 1σ");
    const cpkLower = formulaInput(cpkFormula, "CpkL");
    const cpkUpper = formulaInput(cpkFormula, "CpkU");
    lines.push("- CpkL = (Mean - LSL) / (3 × RSS 1σ)");
    if (lowerMean && lowerLsl && lowerRss) lines.push(`- 代入：(${signedNumber(lowerMean.value)} - ${signedNumber(lowerLsl.value)}) / (3 × ${signedNumber(lowerRss.value)}) = ${signedNumber(lowerCpkFormula.result.value, 3)}`);
    lines.push("- CpkU = (USL - Mean) / (3 × RSS 1σ)");
    if (upperUsl && upperMean && upperRss) lines.push(`- 代入：(${signedNumber(upperUsl.value)} - ${signedNumber(upperMean.value)}) / (3 × ${signedNumber(upperRss.value)}) = ${signedNumber(upperCpkFormula.result.value, 3)}`);
    lines.push("- Cpk = min(CpkL, CpkU)");
    if (cpkLower && cpkUpper) lines.push(`- 代入：min(${signedNumber(cpkLower.value, 3)}, ${signedNumber(cpkUpper.value, 3)}) = ${signedNumber(cpkFormula.result.value, 3)}`);
  }
  pushSection(lines, 10, "变异贡献分析 Contributor Analysis");
  lines.push("| Rank | Factor | 1σ | Contribution | Cumulative |", "|---:|---|---:|---:|---:|");
  for (const contributor of sections.contributorAnalysis.contributors) lines.push(`| ${contributor.rank} | ${cell(contributor.factor.factorName)} | ${quantityText(contributor.sigma)} | ${formatPercent(contributor.contributionPercent)} | ${formatPercent(contributor.cumulativePercent)} |`);
  lines.push(`- 限制：${cell(sections.contributorAnalysis.interpretationLimit)}`);
  pushSection(lines, 11, "敏感度与优化收益分析");
  if (sections.sensitivityAndOptimization.options.length === 0) lines.push(`- ${evidenceLabel("MISSING")} 未提供受控优化目标，不量化改善收益。`);
  for (const option of sections.sensitivityAndOptimization.options) lines.push(`- Option ${cell(option.optionId)}：${cell(option.status)}`);
  pushSection(lines, 12, "风险评估");
  if (sections.riskAssessment.risks.length === 0) lines.push("- 当前没有受支持的风险结论；未覆盖项保持 Unknown。");
  for (const risk of sections.riskAssessment.risks) lines.push(`- ${cell(risk.category)} / ${cell(risk.rating)}：${cell(risk.trigger)}；Confidence ${cell(risk.confidence)}`);
  pushSection(lines, 13, "工程建议");
  for (const action of [...sections.engineeringRecommendations.mandatoryActions, ...sections.engineeringRecommendations.validationActions, ...sections.engineeringRecommendations.conditionalOptimizations]) lines.push(`- ${cell(action.rationale)}；验证：${cell(action.validationRequired)}`);
  pushSection(lines, 14, "设计意图审查 Design Intent Review");
  for (const check of sections.designIntentReview.checks) lines.push(`- ${cell(check.topic)}：${cell(check.status)}；${cell(check.finding)}`);
  pushSection(lines, 15, "数据缺口与待确认事项");
  for (const priority of ["P0", "P1", "P2"]) for (const gap of worksheet.dataGaps.filter((candidate) => candidate.priority === priority)) lines.push(`- ${priority} / ${cell(gap.gapId)}：${cell(gap.missingInformation)}；验证：${cell(gap.verificationMethod)}`);
  pushSection(lines, 16, "最终结论");
  const conclusion = sections.finalConclusion;
  lines.push(`- 最终判定：${cell(conclusion.decision)}`, `- Baseline判定：${cell(conclusion.baselineDecision)}`, `- ${cell(conclusion.summary)}`, "- 下一步行动：", ...conclusion.nextActions.map((action, index) => `  ${index + 1}. ${cell(action)}`));
}

export function renderComposedEngineeringReport(report, options = {}) {
  void options;
  let parsed;
  try {
    parsed = f6ComposedEngineeringReportSchema.parse(report);
  } catch {
    throw new Error("Invalid F6 composed engineering report.");
  }
  const lines = [
    "# F5 + F6 联合公差分析报告 V2",
    "",
    "## Workbook 执行摘要",
    "",
    `- Overall Status：${cell(parsed.overallStatus)}`,
    `- Worksheets：${parsed.workbookSummary.worksheetStatuses.length}`,
    `- P0 Blocking Gaps：${parsed.workbookSummary.blockingGapCount}`,
  ];
  for (const blocked of parsed.blockedWorksheets) lines.push(`- Blocked Worksheet ${cell(blocked.worksheetName)}：INCOMPLETE`);
  for (const worksheet of parsed.worksheets) renderWorksheetV2(lines, worksheet);
  return `${lines.join("\n").trimEnd()}\n`;
}
