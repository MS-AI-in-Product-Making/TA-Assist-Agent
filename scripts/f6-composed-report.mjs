import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
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

function thresholdText(quantity) {
  if (quantity === null) return "未提供";
  if (Math.abs(quantity.value) < 0.001) return `${quantity.value.toExponential()} ${quantity.unit}`;
  return quantityText(quantity, 6);
}

function rangeText(range, decimals = 3) {
  return range === null ? "未提供" : `${range.lower.toFixed(decimals)} ～ ${range.upper.toFixed(decimals)} ${range.unit}`;
}

function signedNumber(value, decimals = 6) {
  const fixed = Number(value).toFixed(decimals);
  return fixed.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

function formulaInput(formula, name) {
  return formula.inputs.find((input) => input.name === name);
}

function marginResult(minimumMargin) {
  return minimumMargin >= 0 ? "PASS" : "FAIL";
}

function scenarioInputText(input) {
  if (input === null) return "n/a";
  const nominal = quantityText(input.nominal, 6);
  const upper = input.upperTolerance === null ? "n/a" : quantityText(input.upperTolerance, 6);
  const lower = input.lowerTolerance === null ? "n/a" : quantityText(input.lowerTolerance, 6);
  return `${nominal} / ${upper} / ${lower}`;
}

function scenarioMetricText(metrics, minimumMargin) {
  const yieldText = metrics.yield === null ? "n/a" : formatPercent(metrics.yield * 100, 2);
  return `RSS ${signedNumber(metrics.rssSigma, 6)}; Cpk ${signedNumber(metrics.cpk, 3)}; Margin ${signedNumber(minimumMargin, 3)}; Yield ${yieldText}`;
}

function scenarioDeltaText(deltas) {
  const yieldDelta = deltas.yield === null ? "n/a" : signedNumber(deltas.yield, 6);
  return `ΔRSS ${signedNumber(deltas.rssSigma, 6)}; ΔCpk ${signedNumber(deltas.cpk, 3)}; ΔMargin ${signedNumber(deltas.minimumMargin, 3)}; ΔYield ${yieldDelta}`;
}

function scenarioTargetLabel(row) {
  const factor = row.factor === null ? "system target" : `${row.factor.factorName} [row ${row.factor.sourceRow}]`;
  if (row.apportionment !== null) {
    const selected = row.apportionment.selectedFactors.map((item) => `${item.factorName}(row ${item.sourceRow})`).join(", ");
    return `${factor}; ${row.targetType}; ${row.apportionment.policy}; ${selected}`;
  }
  return `${factor}; ${row.targetType}`;
}

function processGuidanceLine(factor) {
  const guidance = factor.processGuidance;
  if (guidance === undefined) return null;
  if (guidance.status === "within-guidance" || guidance.status === "guidance-exceeded") {
    return `${factor.factor.factorName} [row ${factor.factor.sourceRow}] ${guidance.status}; RULE: F0 ${guidance.capabilityVersion}; assessedTotalBand=${guidance.assessedTotalBand}; maximumRecommendedTotalBand=${guidance.maximumRecommendedTotalBand}; matchedEntryId=${guidance.matchedEntryId}; fallbackApplied=${guidance.fallbackApplied}`;
  }
  if (guidance.status === "unknown") {
    return `${factor.factor.factorName} [row ${factor.factor.sourceRow}] unknown; INSUFFICIENT_EVIDENCE: ${guidance.f0InformationReason}`;
  }
  return `${factor.factor.factorName} [row ${factor.factor.sourceRow}] not_applicable`;
}

function findFormula(formulas, outputField, formulaId) {
  return formulas.find((formula) => formula.outputField === outputField)
    ?? formulas.find((formula) => formula.formulaId === formulaId)
    ?? null;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function encodeRelativeHref(relativePath) {
  return relativePath
    .split(/[\\/]/)
    .map((segment) => segment === "." || segment === ".."
      ? segment
      : encodeURIComponent(segment).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

function imageHref(imageReference, { outputRoot, f1ArtifactRoot, publishRoot }) {
  if (typeof outputRoot !== "string" || outputRoot.length === 0
    || typeof f1ArtifactRoot !== "string" || f1ArtifactRoot.length === 0
    || typeof publishRoot !== "string" || publishRoot.length === 0) {
    return undefined;
  }

  try {
    const controlledPublishRoot = realpathSync(publishRoot);
    const controlledRoot = realpathSync(f1ArtifactRoot);
    const controlledOutputRoot = realpathSync(outputRoot);
    const lexicalTarget = path.resolve(controlledRoot, imageReference.relativePath);
    if (!isContained(controlledRoot, lexicalTarget) || !existsSync(lexicalTarget)) {
      throw new Error("invalid image target");
    }
    const controlledTarget = realpathSync(lexicalTarget);
    if (!isContained(controlledRoot, controlledTarget)) throw new Error("invalid image target");
    if (!isContained(controlledPublishRoot, controlledOutputRoot)
      || !isContained(controlledPublishRoot, controlledTarget)) {
      throw new Error("image link escapes publish root");
    }
    const relative = path.relative(controlledOutputRoot, controlledTarget);
    if (path.isAbsolute(relative)) throw new Error("invalid relative image link");
    return encodeRelativeHref(relative);
  } catch {
    return undefined;
  }
}

function imageLink(imageReference, options) {
  const href = imageHref(imageReference, options);
  return href === undefined ? "F1 图片证据链接不可用" : `[F1 图片](${href})`;
}

function pushSection(lines, number, title) {
  lines.push("", `## ${number}. ${title}`, "");
}

function renderWorksheetV2(lines, worksheet, options) {
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
  lines.push(
    `- 分析特性：${cell(objective.analysisCharacteristic ?? "未提供")}`,
    `- 结构化工程定义：${cell(objective.analysisObject?.name ?? "未提供")}`,
    `- Target：${quantityText(objective.target)}`,
    `- LSL：${quantityText(objective.lsl)}`,
    `- USL：${quantityText(objective.usl)}`,
    `- Target Cpk：${objective.targetCpk?.toFixed(3) ?? "未提供"} ratio`,
  );
  pushSection(lines, 3, "分析工况与适用边界");
  if (sections.operatingConditions.conditions.length === 0) lines.push(`- ${evidenceLabel("MISSING")} 未提供受控工况。`);
  for (const condition of sections.operatingConditions.conditions) lines.push(`- ${cell(condition.category)}：${cell(condition.description)}`);
  pushSection(lines, 4, "输入数据与完整性检查");
  lines.push(`- 完整性评级：${cell(sections.inputIntegrity.rating)}`, "", "| Factor | Mean | +Tol | -Tol | Distribution | 1σ | Confidence |", "|---|---:|---:|---:|---|---:|---|");
  for (const factor of sections.inputIntegrity.factors) lines.push(`| ${cell(factor.factor.factorName)} | ${quantityText(factor.mean)} | ${quantityText(factor.upperTolerance)} | ${quantityText(factor.lowerTolerance)} | ${cell(factor.distribution)} | ${quantityText(factor.sigma)} | ${cell(factor.confidence)} |`);
  const processGuidanceLines = sections.inputIntegrity.factors
    .map(processGuidanceLine)
    .filter((line) => line !== null);
  if (processGuidanceLines.length > 0) {
    lines.push("", "- F0 process guidance:");
    for (const line of processGuidanceLines) lines.push(`  - ${cell(line)}`);
  }
  if (sections.inputIntegrity.governanceSummary) {
    const summary = sections.inputIntegrity.governanceSummary;
    lines.push(
      "",
      `- Drawing Number 缺失：${summary.drawingNumberMissingCount}/${summary.factorCount}`,
      `- DIM ID 缺失：${summary.dimIdMissingCount}/${summary.factorCount}`,
      `- 影响 source rows：${summary.affectedSourceRows.length > 0 ? summary.affectedSourceRows.join(", ") : "无"}`,
    );
  }
  pushSection(lines, 5, "公差链定义 Tolerance Loop Definition");
  lines.push(`- Loop起点：${cell(sections.toleranceLoopDefinition.start ?? "未提供")}`, `- Loop终点：${cell(sections.toleranceLoopDefinition.end ?? "未提供")}`, `- 完整公式：${cell(sections.toleranceLoopDefinition.equation ?? "Loop方向待工程师确认")}`);
  const loopEvidence = sections.toleranceLoopDefinition.loopEvidence;
  if (loopEvidence) {
    lines.push(
      `- F1 tolerance-path image：${imageLink(loopEvidence.imageReference, options)}`,
      `- tolerance loop description：${cell(loopEvidence.toleranceLoopDescription)}`,
      "- factor descriptions：",
      ...loopEvidence.factorDescriptions.map((row) => `  - Row ${row.sourceRow} [${cell(row.tableId)}] ${cell(row.factorDescription)}`),
    );
    if (loopEvidence.visualFacts.length > 0) {
      lines.push("- Visual FACT：");
      for (const fact of loopEvidence.visualFacts) {
        lines.push(`  - FACT ${cell(fact.statementId)}：${cell(fact.scope)} / ${cell(fact.observedValue)} / ${cell(fact.confidence)} / ${cell(fact.reviewStatus)}；${cell(fact.visibleBasis)}`);
      }
    }
    if (loopEvidence.contextSignals.length > 0) {
      lines.push("- Context SIGNAL：");
      for (const signal of loopEvidence.contextSignals) {
        lines.push(`  - SIGNAL ${cell(signal.statementId)}：${cell(signal.scope)} / ${cell(signal.signalValue)}；${cell(signal.textBasis)}`);
      }
    }
    lines.push(`- ME review required：${cell(loopEvidence.requiresEngineeringReview)}`);
    if (!loopEvidence.signedEquationAuthorized) {
      lines.push("- 图片显示尺寸链方向和标签，但尚未建立视觉标签到 factor/source row 的受治理映射，因此不能生成 signed equation。");
    }
  }
  pushSection(lines, 6, "Loop 一致性与计算自检");
  const consistencyChecks = [
    sections.calculationSelfCheck.meanCheck,
    sections.calculationSelfCheck.rssCheck,
    sections.calculationSelfCheck.worstCaseUpperCheck ?? null,
    sections.calculationSelfCheck.worstCaseLowerCheck ?? null,
    sections.calculationSelfCheck.worstCaseCheck,
  ].filter(Boolean);
  for (const check of consistencyChecks) lines.push(`- ${cell(check.checkId)}：${cell(check.result)}；Difference ${quantityText(check.difference)}；Tolerance ${thresholdText(check.tolerance)}`);
  lines.push(
    "",
    "#### F4 基线复算与数值一致性检查",
    "",
    "| Check ID | F6 recomputed | F4 reported | Abs difference | Threshold | Basis | Result |",
    "|---|---:|---:|---:|---:|---|---|",
  );
  for (const check of consistencyChecks) {
    const absoluteDifference = { value: Math.abs(check.difference.value), unit: check.difference.unit };
    lines.push(
      `| ${cell(check.checkId)} | ${quantityText(check.calculated, 6)} | ${quantityText(check.reported, 6)} | ${quantityText(absoluteDifference, 6)} | ${thresholdText(check.tolerance)} | ${cell(check.toleranceBasis)} | ${cell(check.result)} |`,
    );
  }
  pushSection(lines, 7, "统计分析结果");
  const stats = sections.statisticalResults;
  lines.push(`- ${evidenceLabel("CALCULATED")} Mean：${quantityText(stats.mean)}`, `- RSS 1σ：${quantityText(stats.rssSigma)}`, `- Worst Case：${rangeText(stats.worstCase)}`);
  const targetSigmaLevel = sections.specificationAndMargins.assessment.statistical.sigmaLevel;
  const targetRange = stats.ranges.find((range) => range.sigmaLevel === targetSigmaLevel) ?? null;
  for (const range of stats.ranges) {
    lines.push(`- ${range.sigmaLevel}σ statistical range：${rangeText(range.range)} (formulaCheckId: ${cell(range.formulaCheckId)})`);
  }
  for (const formula of stats.formulaChecks) {
    const value = formula.result.unit === "ratio"
      ? signedNumber(formula.result.value, 3)
      : signedNumber(formula.result.value);
    lines.push(`- FormulaCheck ${cell(formula.outputField)} [${cell(formula.formulaId)}]：${cell(formula.expression)} = ${value} ${cell(formula.result.unit)}`);
  }
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
  if ((sections.sensitivityAndOptimization.scenarioComparisons ?? []).length > 0) {
    lines.push(
      "| Scenario | Factor/Target | Baseline Nominal/+Tol/-Tol | Adjusted Nominal/+Tol/-Tol | RSS | Cpk | Minimum Margin | Yield | Delta |",
      "|---|---|---|---|---|---|---|---|---|",
    );
    for (const row of sections.sensitivityAndOptimization.scenarioComparisons ?? []) {
      const yieldValue = row.scenarioMetrics.yield === null ? "n/a" : formatPercent(row.scenarioMetrics.yield * 100, 2);
      lines.push(
        `| ${cell(row.optionId)} | ${cell(scenarioTargetLabel(row))} | ${cell(scenarioInputText(row.baselineInput))} | ${cell(scenarioInputText(row.adjustedInput))} | ${signedNumber(row.scenarioMetrics.rssSigma, 6)} | ${signedNumber(row.scenarioMetrics.cpk, 3)} | ${signedNumber(row.scenarioMinimumMargin, 3)} | ${cell(yieldValue)} | ${cell(scenarioDeltaText(row.deltas))} |`,
      );
    }
  } else {
    if (sections.sensitivityAndOptimization.options.length === 0) lines.push(`- ${evidenceLabel("MISSING")} 未提供受控优化目标，不量化改善收益。`);
    for (const option of sections.sensitivityAndOptimization.options) {
      if (option.status === "candidate") {
        const factors = option.candidateFactors.map((factor) => `${factor.factorName}(row ${factor.sourceRow})`).join(", ");
        lines.push(`- Candidate ${cell(option.optionId)}：${cell(option.reasonCode)}；候选因子：${cell(factors)}；required inputs：${cell(option.requiredInputs.join(", "))}`);
      } else {
        lines.push(`- Option ${cell(option.optionId)}：${cell(option.status)}`);
      }
    }
  }
  if (sections.sensitivityAndOptimization.targets.length > 0) {
    lines.push("", "- Governed targets:");
    for (const target of sections.sensitivityAndOptimization.targets) {
      lines.push(`  - ${cell(target.targetId)} / ${cell(target.targetType)}`);
    }
  }
  pushSection(lines, 12, "风险评估");
  if (sections.riskAssessment.risks.length === 0) lines.push("- 当前没有受支持的风险结论；未覆盖项保持 Unknown。");
  for (const risk of sections.riskAssessment.risks) lines.push(`- ${cell(risk.category)} / ${cell(risk.rating)}：${cell(risk.trigger)}；Confidence ${cell(risk.confidence)}`);
  pushSection(lines, 13, "工程建议");
  for (const action of [...sections.engineeringRecommendations.mandatoryActions, ...sections.engineeringRecommendations.validationActions, ...sections.engineeringRecommendations.conditionalOptimizations]) lines.push(`- ${cell(action.rationale)}；验证：${cell(action.validationRequired)}`);
  pushSection(lines, 14, "设计意图审查 Design Intent Review");
  for (const check of sections.designIntentReview.checks) lines.push(`- ${cell(check.topic)}：${cell(check.status)}；${cell(check.finding)}`);
  pushSection(lines, 15, "数据缺口与待确认事项");
  if ((sections.dataGaps.actionPlan ?? []).length > 0) {
    lines.push(
      "| Priority | Action | Scope | Owner | Required evidence | Blocks decision | Verification |",
      "|---|---|---|---|---|---|---|",
    );
    for (const action of sections.dataGaps.actionPlan ?? []) {
      lines.push(`| ${cell(action.priority)} | ${cell(action.action)} | ${cell(action.scope.join("; "))} | ${cell(action.owner)} | ${cell(action.requiredEvidence.join("; "))} | ${cell(action.blocksDecision ? "yes" : "no")} | ${cell(action.verification)} |`);
    }
    lines.push("");
  }
  for (const priority of ["P0", "P1", "P2"]) for (const gap of worksheet.dataGaps.filter((candidate) => candidate.priority === priority)) lines.push(`- ${priority} / ${cell(gap.gapId)}：${cell(gap.missingInformation)}；验证：${cell(gap.verificationMethod)}`);
  pushSection(lines, 16, "最终结论");
  const conclusion = sections.finalConclusion;
  lines.push(`- 最终判定：${cell(conclusion.decision)}`, `- Baseline判定：${cell(conclusion.baselineDecision)}`, `- ${cell(conclusion.summary)}`, "- 下一步行动：", ...conclusion.nextActions.map((action, index) => `  ${index + 1}. ${cell(action)}`));
}

export function renderComposedEngineeringReport(report, options = {}) {
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
  for (const worksheet of parsed.worksheets) renderWorksheetV2(lines, worksheet, options);
  return `${lines.join("\n").trimEnd()}\n`;
}
