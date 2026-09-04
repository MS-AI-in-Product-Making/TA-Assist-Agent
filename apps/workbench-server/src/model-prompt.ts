import type { TaModelContextEnvelope } from "@ai-assist/contracts";
import { detectUserLanguage, productCapabilityLabel, projectProductCapabilityReferences, type UserLanguage } from "@ai-assist/product-language";

import { isSupportedGovernedImageMediaType, sanitizePromptVisibleText } from "./prompt-sanitizer.js";

const MAX_F0_EXCERPTS = 6;
const MAX_FACTOR_EXCERPTS = 8;

export function buildEvidenceLabeledModelPrompt(userText: string, context: TaModelContextEnvelope): string {
  const language = detectUserLanguage(userText);
  const projectedUserText = projectProductCapabilityReferences(userText, language);
  const capability = (internalId: "F0" | "F1" | "F2" | "F4") => productCapabilityLabel(internalId, language);
  const supportedToleranceLoopImage = context.toleranceLoopImage !== undefined && isSupportedGovernedImageMediaType(context.toleranceLoopImage.mediaType)
    ? {
      artifactId: context.toleranceLoopImage.artifactId,
      worksheetName: context.toleranceLoopImage.worksheetName,
      contentHash: context.toleranceLoopImage.contentHash,
      mediaType: context.toleranceLoopImage.mediaType,
      ...(sanitizePromptVisibleText(context.toleranceLoopImage.description) === undefined ? {} : { description: sanitizePromptVisibleText(context.toleranceLoopImage.description) }),
    }
    : undefined;
  const governedEvidence = [
    `- Session: ${context.session.sessionId} (revision ${context.session.revision}, inputRevision ${context.inputRevision})`,
    `- Worksheet: ${context.worksheet.worksheetName}`,
    ...(context.worksheet.tableId === undefined || context.worksheet.sourceRow === undefined || context.worksheet.factorName === undefined
      ? []
      : [`- Selected factor identity: ${context.worksheet.tableId} / row ${context.worksheet.sourceRow} / ${context.worksheet.factorName}`]),
    ...(context.worksheet.calculationReference === undefined ? [] : [`- Scenario identity: ${context.worksheet.calculationReference}`]),
    `- Related artifact IDs: ${context.relatedArtifactIds.join(", ")}`,
    `- ${capability("F0")}${language === "zh" ? "摘录" : " excerpts"} (${Math.min(context.f0Knowledge.length, MAX_F0_EXCERPTS)} of ${context.f0Knowledge.length}):`,
    ...formatNestedExcerpts(context.f0Knowledge.slice(0, MAX_F0_EXCERPTS).map((item) => ({
      factorName: item.factorName,
      tableId: item.tableId,
      sourceRow: item.sourceRow,
      capabilityStatus: item.capabilityStatus,
      ...(item.f0KnowledgeBaseVersion === undefined ? {} : { f0KnowledgeBaseVersion: item.f0KnowledgeBaseVersion }),
      summary: productizeEvidenceText(sanitizePromptVisibleText(item.summary) ?? "[redacted credential]", language),
      ...(item.recommendation === undefined ? {} : { recommendation: item.recommendation }),
    }))),
    ...(supportedToleranceLoopImage === undefined
      ? []
      : [
        `- ${capability("F1")} managed image reference:`,
        ...formatNestedExcerpts([supportedToleranceLoopImage]),
      ]),
    `- ${capability("F2")} factor table excerpts (${Math.min(context.factorTable.length, MAX_FACTOR_EXCERPTS)} of ${context.factorTable.length}):`,
    ...formatNestedExcerpts(context.factorTable.slice(0, MAX_FACTOR_EXCERPTS).map((row) => ({
      factorName: row.factorName,
      tableId: row.tableId,
      sourceRow: row.sourceRow,
      ...(row.partName === undefined ? {} : { partName: row.partName }),
      unit: row.unit,
      nominalValue: row.nominalValue,
      upperTolerance: row.upperTolerance,
      lowerTolerance: row.lowerTolerance,
      ...(row.distribution === undefined ? {} : { distribution: row.distribution }),
      ...(row.mean === undefined ? {} : { mean: row.mean }),
      ...(row.tolerance === undefined ? {} : { tolerance: row.tolerance }),
      ...(row.oneSigma === undefined ? {} : { oneSigma: row.oneSigma }),
      ...(row.contribution === undefined ? {} : { contribution: row.contribution }),
      ...(sanitizePromptVisibleText(row.notes) === undefined ? {} : { notes: sanitizePromptVisibleText(row.notes) }),
    }))),
    ...(context.baselineMetrics === undefined
      ? []
      : [
        `- ${capability("F4")} baseline metrics:`,
        ...formatNestedExcerpts([formatMetricExcerpt(context.baselineMetrics)]),
      ]),
    ...(context.scenarioMetrics === undefined
      ? []
      : [
        "- Scenario metrics:",
        ...formatNestedExcerpts([formatMetricExcerpt(context.scenarioMetrics)]),
      ]),
  ];

  const missingEvidence = [
    ...(supportedToleranceLoopImage === undefined ? [`- ${capability("F1")} managed image reference is unavailable in the current governed context.`] : []),
    ...(context.baselineMetrics === undefined ? [`- ${capability("F4")} baseline metrics are unavailable in the current governed context.`] : []),
    ...(context.scenarioMetrics === undefined ? ["- Scenario metrics are unavailable in the current governed context."] : []),
  ];

  const suggestedChecks = [
    ...(context.baselineMetrics === undefined || context.scenarioMetrics === undefined
      ? []
      : [`- Compare baseline ${context.baselineMetrics.calculationReference} against Scenario ${context.scenarioMetrics.calculationReference} before recommending changes.`]),
    ...(context.worksheet.tableId === undefined || context.worksheet.sourceRow === undefined || context.worksheet.factorName === undefined
      ? []
      : [`- Confirm the selected factor identity ${context.worksheet.tableId} / row ${context.worksheet.sourceRow} / ${context.worksheet.factorName} against the current worksheet review.`]),
    "- If the answer depends on evidence outside these excerpts, say that it is missing instead of inferring it.",
  ];

  return [
    "User request",
    projectedUserText.trim(),
    "",
    "Response language",
    language === "zh"
      ? "- 全部使用中文回答，包括解释、建议、进度和操作说明。"
      : "- Respond entirely in English, including explanations, recommendations, progress, and action text.",
    "- Use product capability names only. Never expose internal feature identifiers.",
    "",
    "Governed evidence",
    ...governedEvidence,
    "",
    "Open interpretation",
    "- Explain risk, likely drivers, and trade-offs only from the governed evidence above.",
    "- Clearly label any causal explanation, prioritization, or recommendation as interpretation rather than governed fact.",
    "- Do not claim direct workbook, filesystem, or unmanaged image access.",
    "",
    "Missing evidence",
    ...(missingEvidence.length === 0 ? ["- None identified in the current governed context."] : missingEvidence),
    "",
    "Suggested checks",
    ...suggestedChecks,
  ].join("\n");
}

function formatMetricExcerpt(metric: NonNullable<TaModelContextEnvelope["baselineMetrics"]>) {
  return {
    calculationReference: metric.calculationReference,
    mean: metric.mean,
    rssSigma: metric.rssSigma,
    cp: metric.cp,
    cpkL: metric.cpkL,
    cpkU: metric.cpkU,
    cpk: metric.cpk,
    statisticalMargin: metric.statisticalMargin,
    worstCaseMargin: metric.worstCaseMargin,
    ...(metric.lowerSpecLimit === undefined ? {} : { lowerSpecLimit: metric.lowerSpecLimit }),
    ...(metric.upperSpecLimit === undefined ? {} : { upperSpecLimit: metric.upperSpecLimit }),
    ...(metric.yield === undefined ? {} : { yield: metric.yield }),
    ...(metric.dpm === undefined ? {} : { dpm: metric.dpm }),
    ...(metric.statisticalLower === undefined ? {} : { statisticalLower: metric.statisticalLower }),
    ...(metric.statisticalUpper === undefined ? {} : { statisticalUpper: metric.statisticalUpper }),
    ...(metric.worstCaseLower === undefined ? {} : { worstCaseLower: metric.worstCaseLower }),
    ...(metric.worstCaseUpper === undefined ? {} : { worstCaseUpper: metric.worstCaseUpper }),
  };
}

function formatNestedExcerpts(excerpts: readonly Record<string, unknown>[]): string[] {
  if (excerpts.length === 0) return ["  - none"];
  return excerpts.map((excerpt) => `  - ${JSON.stringify(excerpt)}`);
}

function productizeEvidenceText(text: string, language: UserLanguage): string {
  return projectProductCapabilityReferences(text, language);
}