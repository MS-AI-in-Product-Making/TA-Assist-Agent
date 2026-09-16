import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { analysisRequestContextSchema } from "../packages/contracts/dist/analysis-request-context.js";
import {
  drawingGovernanceResultV2Schema,
  drawingGovernanceResultV3Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f6AnalysisContextSchema,
  f6ModelInterpretationArtifactSchema,
  f6ReadableOptimizationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import { createF5MultimodalFactorSetHash, f5MultimodalArtifactV3Schema, f5MultimodalArtifactV4Schema } from "../packages/contracts/dist/ta-multimodal-contracts.js";
import { createCalculation } from "../packages/workbook-catalog/dist/calculation.js";
import {
  createCalculationRequestFromF4Handoff,
  createF4Handoff,
} from "../packages/workbook-catalog/dist/f4-handoff.js";
import { createF6ProcessChecks, createF6ReportProjection, F6_DISPOSITION_RANK, worstDisposition } from "../packages/workbook-catalog/dist/index.js";
import { formatEngineering, formatPercent } from "./engineering-format.mjs";
import {
  renderCalculationClaims,
  safeText,
  validateModelMarkdown,
} from "./f6-markdown-sanitizer.mjs";

export { F6_DISPOSITION_RANK, worstDisposition };

const NOT_PROVIDED = "NOT_PROVIDED";
const INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE";
const NA = "N/A";
const MODEL_RISK_DISCLOSURE = "Model interpretation may contain hallucinations, label mismatches, or omissions and must be reviewed by ME.";
const MODEL_RISK_DISCLOSURE_PATTERN = /Model interpretation may contain hallucinations,\s*label mismatches,\s*or omissions and must be reviewed by ME\./giu;
const PRODUCT_CAPABILITIES = {
  dataCleaning: "Data Cleaning",
  calculationEngine: "Calculation Engine",
  analysisInterpretation: "Analysis Interpretation",
  reportEnhancement: "Report Enhancement",
  drawingGovernance: "Drawing Governance",
};
const F6_PROCESS_CHECK_LABELS = {
  "analysis-method": "Analysis Method",
  "input-completeness": "Input Completeness",
  "output-completeness": "Output Completeness",
  "tolerance-validity": "Tolerance Validity",
  "drawing-dim-governance": "Drawing/DIM Governance",
  "ado-traceability": "ADO Traceability",
  "target-sigma": "Target Sigma",
};
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

function indexByWorksheetName(records) {
  return new Map(records.map((record) => [record.worksheetName, record]));
}

function isExactWorksheetSet(worksheetNames, readyNames) {
  const worksheetNameSet = new Set(worksheetNames);
  const readyNameSet = new Set(readyNames);

  return worksheetNames.length === worksheetNameSet.size
    && readyNames.length === readyNameSet.size
    && worksheetNameSet.size === readyNameSet.size
    && [...worksheetNameSet].every((name) => readyNameSet.has(name));
}

function assertExactWorksheetSet(worksheetNames, readyNames, label) {
  if (!isExactWorksheetSet(worksheetNames, readyNames)) {
    throw new Error(`Invalid F6 final report input: ${label}.`);
  }
}

function assertReportScope(f2Report, f6Optimization, blockedWorksheetDetailsByName = new Map()) {
  const reportScope = f6Optimization.provenance.reportScope;
  const allWorksheetNames = f2Report.worksheets.map(({ worksheetName }) => worksheetName);
  const readyWorksheetNames = f2Report.worksheets
    .filter(({ status }) => status === "ready")
    .map(({ worksheetName }) => worksheetName);
  if (reportScope.blockedWorksheetNames === undefined) {
    if (allWorksheetNames.length !== readyWorksheetNames.length
      || !isDeepStrictEqual(reportScope.worksheetNames, readyWorksheetNames)) failInvalid("report scope");
    return;
  }
  const expectedBlockedWorksheetNames = f2Report.worksheets
    .filter(({ status }) => status === "blocked")
    .map(({ worksheetName }) => worksheetName);
  if (expectedBlockedWorksheetNames.some((worksheetName) => !reportScope.blockedWorksheetNames.includes(worksheetName))) {
    failInvalid("report scope");
  }
  if (reportScope.blockedWorksheetNames.some((worksheetName) => !expectedBlockedWorksheetNames.includes(worksheetName)
    && !blockedWorksheetDetailsByName.has(worksheetName))) {
    failInvalid("report scope");
  }
  if (!isDeepStrictEqual(reportScope.worksheetNames, allWorksheetNames)
    || reportScope.blockedWorksheetNames.some((worksheetName) => !allWorksheetNames.includes(worksheetName))) {
    failInvalid("report scope");
  }
}

const F6_V3_REPORT_CATALOG = {
  en: {
    title: "TA Engineering Analysis Report", document: "Document Overview", workbook: "Workbook Summary", worksheet: "Worksheet",
    image: "Tolerance Path Image", openImage: "Open tolerance path image", factors: "Complete Factor Table",
    interpretation: "Image and Factor Table Context Interpretation", results: "Requirements and Statistical Results",
    f0Guidance: "F0 Capability and Knowledge Guidance", center: "Adjusted Mean to Spec Center Shift",
    contributors: "Contributor Priorities", specifications: "Specification Changes", toleranceOptions: "Tolerance Optimization Options",
    factor: "Factor", part: "Part Name",
    drawing: "Drawing Number", dimId: "DIM ID", nominal: "Design Nominal", upperTolerance: "+ Tolerance",
    lowerTolerance: "- Tolerance", distribution: "Distribution", sigmaLevel: "Sigma Level", status: "Status",
    rank: "Rank", priority: "Priority", guidance: "Guidance", side: "Side", currentLimit: "Current Limit",
    proposedLimit: "Proposed Limit", targetCpk: "Target Cpk", approval: "Approval",
    approvalRequired: "Engineering approval required", noProposal: "No specification change is proposed.",
    noToleranceOption: "Capability meets the worksheet target; no built-in tolerance option is required.",
    option: "Option", factorsLabel: "Top 3 Factors", reductionRatios: "Reduction Ratios", resultCpk: "Result Cpk", policy: "Policy",
    clarification: "Clarification required", modelUnavailable: "Model interpretation unavailable",
    high: "High", medium: "Medium", lower: "Lower", topThree: "Focus tolerance-range review on the first three priorities.",
    nominalReminder: "The adjusted mean is off the specification center; optimize Factor nominal values before changing specifications.",
  },
  zh: {
    title: "TA 工程分析报告", document: "文档概览", workbook: "工作簿摘要", worksheet: "工作表", image: "公差路径图片",
    openImage: "打开公差路径图片", factors: "完整 Factor 表", interpretation: "图片与 Factor 表上下文解读",
    results: "要求与统计结果", f0Guidance: "F0 能力与知识库建议", center: "Adjusted Mean to Spec Center Shift",
    contributors: "贡献因子优先级", specifications: "规格变更建议", toleranceOptions: "公差优化方案", factor: "Factor",
    part: "Part Name", drawing: "Drawing Number", dimId: "DIM ID", nominal: "Design Nominal", upperTolerance: "+ Tolerance",
    lowerTolerance: "- Tolerance", distribution: "Distribution", sigmaLevel: "Sigma Level", status: "状态", rank: "排序",
    priority: "优先级", guidance: "建议", side: "规格侧", currentLimit: "当前限值", proposedLimit: "建议限值",
    targetCpk: "目标 Cpk", approval: "审批", approvalRequired: "需要工程审批", noProposal: "无需提出规格变更。",
    noToleranceOption: "能力满足工作表目标，无需运行内置公差方案。", option: "方案", factorsLabel: "Top 3 Factors",
    reductionRatios: "缩减比例", resultCpk: "结果 Cpk", policy: "策略",
    clarification: "需要澄清", modelUnavailable: "模型解读 unavailable",
    high: "高", medium: "中", lower: "较低", topThree: "请着重检查前三优先级 Factor 的公差范围。",
    nominalReminder: "Adjusted Mean 偏离规格中心，请先优化 Factor nominal 值，再评估规格变更。",
  },
};

function v3PriorityLabel(rank, count, catalog) {
  if (rank === 1) return catalog.high;
  if (rank <= Math.max(2, Math.ceil(count / 2))) return catalog.medium;
  return catalog.lower;
}

function v3CalculationFactor(calculation, identity) {
  return calculation.factors.find((factor) => factor.source.worksheetName === identity.worksheetName
    && factor.source.tableId === identity.tableId
    && factor.source.sourceRow === identity.sourceRow
    && factor.factorName === identity.factorName
    && factor.unit === identity.unit);
}

function v3FactorRows(interpretation) {
  if (interpretation === undefined) failInvalid("multimodal worksheet interpretation");
  const interpretations = new Map(interpretation.rowMappings.map((mapping) => [
    JSON.stringify([mapping.tableId, mapping.sourceRow, mapping.factorOrdinal]), mapping.interpretation,
  ]));
  return interpretation.request.factorRows.map((factor) => ({
    ...factor,
    rowInterpretation: interpretations.get(JSON.stringify([factor.tableId, factor.sourceRow, factor.factorOrdinal])),
  }));
}

function factorSourceKey(tableId, sourceRow) {
  return JSON.stringify([tableId, sourceRow]);
}

const COMPLETE_FACTOR_TABLE_HEADERS = [
  "Ordinal",
  "Factor Description",
  "Part Name",
  "Part Category",
  "Drawing Number",
  "DIM ID",
  "Design Nominal",
  "+ Tolerance",
  "- Tolerance",
  "Long Term / Safety Factor",
  "Sigma Level",
  "Mean",
  "Tolerance",
  "One Sigma",
  "Capability / Knowledge Guidance",
];

function blockedMissingFieldMap(missingFieldSummary) {
  const bySourceRow = new Map();
  for (const item of missingFieldSummary ?? []) {
    if (!Array.isArray(item.sourceRows)) continue;
    for (const sourceRow of item.sourceRows) {
      const missingFields = bySourceRow.get(sourceRow) ?? new Set();
      missingFields.add(item.field);
      bySourceRow.set(sourceRow, missingFields);
    }
  }
  return bySourceRow;
}

function blockedMissingFieldSummaryText(missingFieldSummary) {
  if (!Array.isArray(missingFieldSummary) || missingFieldSummary.length === 0) return NA;
  return missingFieldSummary.map((item) => {
    const field = item?.field === undefined ? NA : clean(item.field);
    const count = Number.isFinite(item?.factorCount) ? `x${item.factorCount}` : NA;
    const rows = Array.isArray(item?.sourceRows) && item.sourceRows.length > 0 ? `rows ${item.sourceRows.join(", ")}` : NA;
    if (rows === NA) return `${field} ${count}`;
    return `${field} ${count} (${rows})`;
  }).join("; ");
}

function blockedRequiredField(row, field) {
  return Array.isArray(row.missingRequiredFields) && row.missingRequiredFields.includes(field);
}

function blockedMissingIdentifier(row, identifier) {
  return Array.isArray(row.missingIdentifiers) && row.missingIdentifiers.includes(identifier);
}

function blockedFactorDescription(value, sourceRow) {
  return `${value} <span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="${sourceRow}" hidden aria-hidden="true"></span>`;
}

function evaluationLevelText(value, suffix = " sigma") {
  return Number.isFinite(value) ? `${numberText(value)}${suffix}` : "";
}

function normalizeInterpretationText(value, fallback = NA) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value)
    .replace(MODEL_RISK_DISCLOSURE_PATTERN, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized === "" ? fallback : safeText(normalized);
}

function renderCompleteFactorTable(rows) {
  return [
    row(COMPLETE_FACTOR_TABLE_HEADERS),
    row(COMPLETE_FACTOR_TABLE_HEADERS.map(() => "---")),
    ...rows.flatMap(({ cells, marker }) => {
      const renderedCells = [...cells];
      return marker === undefined ? [row(renderedCells)] : [row(renderedCells), marker];
    }),
  ];
}

function readyFactorTableRows(factors) {
  return factors.map(({ f2Row, modelRow, calculation: factor, f0 }) => {
    const actual = f2Row.actualFields;
    return {
      cells: [
        clean(f2Row.factorOrdinal?.value),
        f2Row.missingIdentifiers?.length > 0
          ? blockedFactorDescription(clean(modelRow.factorName), f2Row.sourceRow)
          : clean(modelRow.factorName),
        clean(actual.partName), clean(actual.partCategory),
        blockedMissingIdentifier(f2Row, "drawingNumber") ? "MISSING" : clean(actual.drawingNumber),
        blockedMissingIdentifier(f2Row, "dimCharacteristicId") ? "MISSING" : clean(actual.dimCharacteristicId),
        engineeringText(factor.input.nominalValue, factor.unit),
        engineeringText(factor.input.upperTolerance, factor.unit), engineeringText(factor.input.lowerTolerance, factor.unit),
        numberText(factor.input.longTermSafetyFactor), numberText(factor.input.sigmaLevel), engineeringText(factor.mean, factor.unit),
        engineeringText(factor.halfTolerance, factor.unit), engineeringText(factor.sigma, factor.unit),
        f0GuidanceText(f2Row, f0),
      ],
    };
  });
}

function blockedFactorTableRows(worksheet) {
  return worksheet.f2Worksheet.rows.map((f2Row) => {
    const actual = f2Row.actualFields;
    const hasBlockedMarker = (Array.isArray(f2Row.missingRequiredFields) && f2Row.missingRequiredFields.length > 0)
      || (Array.isArray(f2Row.missingIdentifiers) && f2Row.missingIdentifiers.length > 0);
    return {
      cells: [
        clean(f2Row.factorOrdinal?.value),
        hasBlockedMarker
          ? blockedFactorDescription(blockedRequiredField(f2Row, "factorName") ? "MISSING" : clean(actual.factorName), f2Row.sourceRow)
          : (blockedRequiredField(f2Row, "factorName") ? "MISSING" : clean(actual.factorName)),
        blockedRequiredField(f2Row, "partName") ? "MISSING" : clean(actual.partName),
        blockedRequiredField(f2Row, "partCategory") ? "MISSING" : clean(actual.partCategory),
        blockedMissingIdentifier(f2Row, "drawingNumber") ? "MISSING" : clean(actual.drawingNumber),
        blockedMissingIdentifier(f2Row, "dimCharacteristicId") ? "MISSING" : clean(actual.dimCharacteristicId),
        blockedRequiredField(f2Row, "nominalValue") ? "MISSING" : engineeringText(actual.nominalValue, "mm"),
        blockedRequiredField(f2Row, "upperTolerance") ? "MISSING" : engineeringText(actual.upperTolerance, "mm"),
        blockedRequiredField(f2Row, "lowerTolerance") ? "MISSING" : engineeringText(actual.lowerTolerance, "mm"),
        blockedRequiredField(f2Row, "longTermSafetyFactor") ? "MISSING" : numberText(actual.longTermSafetyFactor),
        blockedRequiredField(f2Row, "standardDeviation") ? "MISSING" : numberText(actual.sigmaLevel),
        NA,
        NA,
        NA,
        NA,
      ],
    };
  });
}

function f0Recommendation(row) {
  const recommendation = row.recommendation;
  if (recommendation?.kind === "public") return {
    band: `${numberText(recommendation.toleranceMin)}-${numberText(recommendation.toleranceMax)} ${recommendation.unit}`,
    distribution: recommendation.distribution,
    knowledge: `v1 · ${recommendation.capabilityEntryId}`,
  };
  if (recommendation?.kind === "internal-guidance") return {
    band: `<= ${numberText(recommendation.maximumRecommendedTotalBand)} ${recommendation.unit}`,
    distribution: NA,
    knowledge: `internal-v1 · ${recommendation.matchedEntryId}`,
  };
  return { band: NA, distribution: NA, knowledge: row.f0InformationReason ?? NA };
}

function f0GuidanceText(row, recommendation) {
  const parts = [`Capability: ${clean(row.capabilityStatus)}`];
  if (recommendation.band !== NA) parts.push(`Recommended tolerance band or range: ${clean(recommendation.band)}`);
  if (recommendation.distribution !== NA) parts.push(`Recommended distribution: ${clean(recommendation.distribution)}`);
  if (recommendation.knowledge !== NA) parts.push(`Knowledge: ${clean(recommendation.knowledge)}`);
  return parts.join("; ");
}

function v3CompleteFactorRows(worksheet, interpretation) {
  const interpreted = new Map(v3FactorRows(interpretation).map((factor) => [
    factorSourceKey(factor.tableId, factor.sourceRow), factor,
  ]));
  const calculated = new Map(worksheet.f4Calculation.factors.map((factor) => [
    factorSourceKey(factor.source.tableId, factor.source.sourceRow), factor,
  ]));
  return worksheet.f2Worksheet.rows.map((f2Row) => {
    const key = factorSourceKey(f2Row.tableId, f2Row.sourceRow);
    const modelRow = interpreted.get(key);
    const calculation = calculated.get(key);
    if (modelRow === undefined || calculation === undefined) failInvalid("complete Factor identity set");
    return { f2Row, modelRow, calculation, f0: f0Recommendation(f2Row) };
  });
}

function fixedEngineering(value, unit) {
  return Number.isFinite(value) ? `${value.toFixed(3)} ${clean(unit)}` : NA;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function verifiedImageLinks(modelInterpretation, options) {
  if (typeof options.outputRoot !== "string" || typeof options.f1ArtifactRoot !== "string" || typeof options.publishRoot !== "string") {
    return undefined;
  }
  const publishRoot = realpathSync(path.resolve(options.publishRoot));
  const artifactRoot = realpathSync(path.resolve(options.f1ArtifactRoot));
  const outputRoot = realpathSync(path.resolve(options.outputRoot));
  if (!isContained(publishRoot, artifactRoot) || !isContained(publishRoot, outputRoot)) failInvalid("image boundary");
  const links = new Map();
  for (const worksheet of modelInterpretation.worksheets) {
    if (worksheet.status === "failed") continue;
    const image = worksheet.request.image;
    const relativePath = image.artifactPath;
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/u).includes("..") || !/\.(?:png|jpe?g)$/iu.test(relativePath)) {
      failInvalid("image path");
    }
    const sourcePath = path.resolve(artifactRoot, relativePath);
    const realSourcePath = realpathSync(sourcePath);
    const stats = lstatSync(sourcePath);
    if (!isContained(artifactRoot, realSourcePath) || stats.isSymbolicLink() || !stats.isFile()) failInvalid("image boundary");
    const actualHash = createHash("sha256").update(readFileSync(realSourcePath)).digest("hex");
    if (actualHash !== image.contentHash) failInvalid("image hash");
    links.set(worksheet.request.worksheetName, path.relative(outputRoot, realSourcePath).split(path.sep).join("/"));
  }
  return links;
}

function renderF6V3DocumentOverview({ f2Report, analysisContext, analysisRequestContext }, catalog) {
  const readyCount = f2Report.worksheets.filter(({ status }) => status === "ready").length;
  return [
    `## 1. ${catalog.document}`, "",
    "| Field | Value |", "|---|---|",
    row(["Source Workbook", clean(f2Report.workbook.fileName)]),
    row(["Workbook Revision", clean(f2Report.workbook.revision, NA)]),
    row(["Selected Worksheet Count", f2Report.worksheets.length]),
    row(["Ready / Blocked Worksheet Count", `${readyCount} / ${f2Report.worksheets.length - readyCount}`]),
    row(["Analysis Requested At", requestTimestamp(analysisRequestContext)]),
    row(["Reviewed By", reviewStatus(analysisContext)]),
  ];
}

function renderF6V3WorkbookSummary(worksheets, catalog) {
  const lines = [
    `## 2. ${catalog.workbook}`, "",
    "| Result | Worksheet | Tolerance Loop Description | Key Finding |", "|---|---|---|---|",
  ];
  worksheets.forEach((worksheet, index) => lines.push(row([
    dispositionComment(worksheet.disposition),
    `[${clean(worksheet.worksheetName)}](#worksheet-${index + 1})`,
    clean(worksheet.f2Worksheet.toleranceLoopDescription),
    worksheet.f2Worksheet.status === "ready" ? v3PrimaryFinding(worksheet) : blockedWorksheetFinding(worksheet, "en"),
  ])));
  return lines;
}

function adoTraceabilityForReport(f3Report) {
  return f3Report.modelVersion === "drawing-governance-v3" ? f3Report.ado : { status: "not_requested" };
}

function adoTraceabilityLink(ado) {
  if (ado.status !== "updated" || !Number.isInteger(ado.workItemId) || ado.workItemId <= 0) return undefined;
  const operation = ado.operation === "created" ? "Created" : "Updated";
  return `[${operation} Work Item #${ado.workItemId}](https://dev.azure.com/${encodeURIComponent(ado.organization)}/${encodeURIComponent(ado.project)}/_workitems/edit/${ado.workItemId})`;
}

function processCheckAssessment(check, f3Ado) {
  const link = check.checkId === "ado-traceability" ? adoTraceabilityLink(f3Ado) : undefined;
  const summary = clean(check.summary);
  return link === undefined ? summary : `${summary} ${link}`;
}

function createWorksheetProcessChecks(worksheet, analysisContext, f3Ado) {
  return createF6ProcessChecks({
    worksheetName: worksheet.worksheetName,
    toleranceLoopDescription: worksheet.f2Worksheet.toleranceLoopDescription,
    f2Worksheet: worksheet.f2Worksheet,
    f3Worksheet: worksheet.f3Worksheet,
    f3Ado,
    calculation: worksheet.f4Calculation,
    analysisContext,
  });
}

function processCheckProjection(check, f3Ado) {
  return {
    checkId: check.checkId,
    status: check.status,
    assessment: processCheckAssessment(check, f3Ado),
    ...(check.details.length === 0 ? {} : { details: [...check.details] }),
  };
}

function renderProcessAndRequirements(worksheet, analysisContext, f3Ado) {
  const checks = createWorksheetProcessChecks(worksheet, analysisContext, f3Ado);
  return [
    "## Process and Requirements",
    "",
    "| Check | Status | Assessment |",
    "|---|---|---|",
    ...checks.map((check) => row([
      F6_PROCESS_CHECK_LABELS[check.checkId] ?? clean(check.checkId),
      check.status,
      processCheckAssessment(check, f3Ado),
    ])),
  ];
}

function statisticalRangeRows(projection, calculation, unit) {
  const lowerSpec = calculation.capability.lowerSpecLimit;
  const upperSpec = calculation.capability.upperSpecLimit;
  const rows = [3, 4, 6].map((sigmaLevel) => {
    const range = projection.statisticalRanges.find((item) => item.sigmaLevel === sigmaLevel)?.range;
    if (range === undefined) failInvalid(`${sigmaLevel}-sigma report range`);
    const minimumMargin = Math.min(range.lower - lowerSpec, upperSpec - range.upper);
    return row([
      `${sigmaLevel}-Sigma Range`,
      engineeringText(range.lower, unit),
      engineeringText(range.upper, unit),
      engineeringText(minimumMargin, unit),
      minimumMargin >= 0 ? "PASS" : "FAIL",
    ]);
  });
  const worstCase = projection.margins.worstCase;
  rows.push(row([
    "Worst-Case Range",
    engineeringText(worstCase.lowerBound, unit),
    engineeringText(worstCase.upperBound, unit),
    engineeringText(worstCase.minimumMargin, unit),
    worstCase.minimumMargin >= 0 ? "PASS" : "FAIL",
  ]));
  return rows;
}

function renderF6V3Worksheet(worksheet, interpretation, ordinal, catalog, imageLinks, analysisContext, f3Ado) {
  const prefix = `3-${ordinal}`;
  const [center, contributors, specifications] = worksheet.f6Worksheet.steps;
  const verifiedRelativePath = imageLinks?.get(worksheet.worksheetName);
  const relativePath = verifiedRelativePath ?? interpretation?.request?.image?.artifactPath;
  const imageLink = typeof relativePath === "string"
    && (verifiedRelativePath !== undefined || (!relativePath.includes("..") && !/^[A-Za-z]:|^[/\\]/.test(relativePath)))
    ? `[${catalog.openImage}](<${encodeURI(relativePath.replace(/\\/g, "/"))}>)`
    : NA;
  const factors = v3CompleteFactorRows(worksheet, interpretation);
  const calculation = worksheet.f4Calculation;
  const unit = calculation.factors[0]?.unit ?? "unit";
  const projection = createF6ReportProjection({ calculation, inputResolution: 1e-12 });
  const interpretationText = normalizeInterpretationText(interpretation.imageTableInterpretation);
  const lines = [
    `<a id="worksheet-${ordinal}"></a>`, "",
    `# ${prefix} ${catalog.worksheet}: ${clean(worksheet.worksheetName)}`, "",
    `## ${catalog.factors}`, "",
    ...renderCompleteFactorTable(readyFactorTableRows(factors)),
  ];
  lines.push(
    "", ...renderProcessAndRequirements(worksheet, analysisContext, f3Ado),
    "", `## ${catalog.image}`, "", imageLink, "", interpretationText, "", `*${MODEL_RISK_DISCLOSURE}*`,
    "", `## ${catalog.results}`, "",
    "| Requirement | Value |", "|---|---:|",
    row(["Design Nominal", engineeringText(calculation.system.designNominal, unit)]),
    row(["LSL", engineeringText(calculation.capability.lowerSpecLimit, unit)]),
    row(["USL", engineeringText(calculation.capability.upperSpecLimit, unit)]),
    row(["Target Cpk", numberText(calculation.capability.targetCpk)]),
    row(["Evaluation Level", evaluationLevelText(calculation.capability.targetSigmaLevel)]),
    "", "| Metric | Lower | Upper | Minimum Margin | Result |", "|---|---:|---:|---:|---|",
    ...statisticalRangeRows(projection, calculation, unit),
    "", "| Capability Metric | Value | Result |", "|---|---:|---|",
    row(["Predictive Cp", numberText(calculation.capability.cp), clean(calculation.capability.cpStatus)]),
    row(["Predictive CpkL", numberText(calculation.capability.lowerCpk), clean(calculation.capability.lowerCpkStatus)]),
    row(["Predictive CpkU", numberText(calculation.capability.upperCpk), clean(calculation.capability.upperCpkStatus)]),
    row(["Predictive Cpk", numberText(calculation.capability.cpk), clean(calculation.capability.status)]),
    row(["Predicted Yield", percentText(calculation.capability.yield), NA]),
    row(["Predicted DPM", numberText(calculation.capability.totalDpm), NA]),
    "", `- Mean Response: ${engineeringText(calculation.system.mean, unit)}`,
    `- Mean Shift: ${engineeringText(calculation.system.additionalMeanShift, unit)}`,
    `- RSS One Sigma: ${engineeringText(calculation.system.rssSigma, unit)}`,
  );
  lines.push("", `## ${catalog.center}`, "", `- ${catalog.status}: ${clean(center.status)}`);
  if (center.status !== "clarification_required") {
    lines.push(`- Design Nominal: ${fixedEngineering(calculation.system.designNominal, unit)}`,
      `- Adjusted Mean: ${fixedEngineering(center.adjustedMean, unit)}`,
      `- Offset: ${fixedEngineering(center.offset, unit)}`);
  }
  if (center.status === "offset") lines.push(`- ${catalog.nominalReminder}`, `- ${clean(center.interpretation)}`);
  if (center.status === "clarification_required") lines.push(`- ${catalog.clarification}: ${clean(center.reasonCode)}`);
  lines.push("", `## ${catalog.contributors}`, "",
    `| ${catalog.rank} | ${catalog.factor} | One Sigma | Variance Contribution | ${catalog.priority} | ${catalog.guidance} |`, "|---:|---|---:|---:|---|---|");
  const contributorPriorities = Array.isArray(contributors?.priorities) ? contributors.priorities : [];
  for (const item of contributorPriorities) {
    const factor = v3CalculationFactor(calculation, item.factor);
    if (factor === undefined) failInvalid("contributor Factor identity");
    lines.push(row([item.rank, clean(item.factor.factorName), engineeringText(factor.sigma, factor.unit), percentText(item.contribution),
      v3PriorityLabel(item.rank, contributorPriorities.length, catalog), item.rank <= 3 ? clean(item.guidance) : NA]));
  }
  lines.push("", catalog.topThree);
  const specificationProposals = (Array.isArray(specifications?.proposals) ? specifications.proposals : [])
    .filter(({ currentLimit, proposedLimit }) => !nearlyEqual(currentLimit, proposedLimit));
  if ((calculation.capability.lowerCpkStatus === "FAIL" || calculation.capability.upperCpkStatus === "FAIL")
    && specificationProposals.length > 0) {
    lines.push("", `## ${catalog.specifications}`, "");
    lines.push(`| ${catalog.side} | ${catalog.currentLimit} | ${catalog.proposedLimit} | ${catalog.targetCpk} | ${catalog.approval} |`, "|---|---:|---:|---:|---|");
    for (const proposal of specificationProposals) {
      lines.push(row([proposal.side, numberText(proposal.currentLimit), numberText(proposal.proposedLimit), numberText(proposal.targetCpk), catalog.approvalRequired]));
    }
  }
  return lines;
}

function renderF6V3BlockedWorksheet(worksheet, ordinal, catalog, language) {
  const prefix = `3-${ordinal}`;
  return [
    `<a id="worksheet-${ordinal}"></a>`,
    "",
    `# ${prefix} ${catalog.worksheet}: ${clean(worksheet.worksheetName)}`,
    "",
    `- Status: FAIL`,
    `- ${clean(blockedWorksheetFinding(worksheet, language))}`,
    `- ${catalog.modelUnavailable}`,
    `- Required Action: ${clean(requiredAction(worksheet))}`,
    "",
    `## ${catalog.factors}`,
    "",
    ...renderCompleteFactorTable(blockedFactorTableRows(worksheet)),
  ];
}

function createF6V3Report({ f2Report, f3Report, f4Report, f5Report, f6Optimization, modelInterpretation, analysisContext, analysisRequestContext, blockedWorksheetDetailsByName = new Map(), imageLinks }) {
  if (f6Optimization.runStatus !== "COMPLETED" || f6Optimization.worksheets.some(({ runStatus }) => runStatus !== "COMPLETED")) {
    failInvalid("incomplete F6 optimization");
  }
  const worksheets = buildWorksheetPolicyInputs({
    f2Report,
    f3Report,
    f4Report,
    f5Report,
    f6Optimization,
    blockedWorksheetDetailsByName,
  });
  const interpretations = modelInterpretationByWorksheet({ f6Optimization, modelInterpretation });
  const language = "en";
  const catalog = F6_V3_REPORT_CATALOG.en;
  const f3Ado = adoTraceabilityForReport(f3Report);
  const worksheetDispositions = worksheets.map(({ worksheetName, disposition }) => ({ worksheetName, disposition }));
  const workbookDisposition = worstDisposition(worksheetDispositions.map(({ disposition }) => disposition));
  const reportSummary = { workbookDisposition, worksheetDispositions };
  const markdown = [
    `# ${catalog.title}`,
    "",
    ...renderF6V3DocumentOverview({ f2Report, analysisContext, analysisRequestContext }, catalog),
    "",
    ...renderF6V3WorkbookSummary(worksheets, catalog),
  ];
  worksheets.forEach((worksheet, index) => markdown.push(
    "",
    ...((worksheet.f2Worksheet.status === "ready" && worksheet.blocker === undefined)
      ? renderF6V3Worksheet(worksheet, interpretations.get(worksheet.worksheetName), index + 1, catalog, imageLinks, analysisContext, f3Ado)
      : renderF6V3BlockedWorksheet(worksheet, index + 1, catalog, language)),
  ));
  const reportMarkdown = `${markdown.join("\n")}\n`;
  if (/\p{Script=Han}/u.test(reportMarkdown)) {
    throw new Error("Invalid F6 final report input: English-only report content is required.");
  }
  const projection = {
    schemaVersion: "ta-engineering-report-projection-v1", title: catalog.title, workbookDisposition, worksheetDispositions,
    workbook: { fileName: f2Report.workbook.fileName, ...(f2Report.workbook.revision === undefined ? {} : { revision: f2Report.workbook.revision }), contentHash: f2Report.workbook.contentHash },
    worksheets: worksheets.map((worksheet) => {
      const calculation = worksheet.f4Calculation;
      const base = {
        worksheetName: worksheet.worksheetName,
        toleranceLoopDescription: clean(worksheet.f2Worksheet.toleranceLoopDescription, NA),
        disposition: worksheet.disposition,
        requiredAction: requiredAction(worksheet),
        findings: [worksheet.f2Worksheet.status === "ready"
          ? v3PrimaryFinding(worksheet)
          : blockedWorksheetFinding(worksheet, language)],
        assumptions: [],
        clarifications: [],
        gatingEvidenceReferences: worksheet.f2Worksheet.status === "ready"
          ? [`F4:${worksheet.worksheetName}`, `F5-multimodal:${worksheet.worksheetName}`]
          : [`F2:${worksheet.worksheetName}`],
      };
      if (calculation === undefined || worksheet.f6Worksheet === undefined) return base;
      const processChecks = createWorksheetProcessChecks(worksheet, analysisContext, f3Ado)
        .map((check) => processCheckProjection(check, f3Ado));
      return {
        ...base,
        processChecks,
        clarifications: worksheet.f6Worksheet.steps.flatMap((step) => step.step === "centerAssessment" && step.status === "clarification_required"
          ? [step.reasonCode]
          : step.step === "specificationChanges"
            ? step.clarifications.map(({ reasonCode }) => reasonCode)
            : step.step === "toleranceOptimization"
              ? step.options.filter(({ status }) => status === "calculation_failed").map(({ reasonCode }) => reasonCode)
              : []),
        metrics: { mean: calculation.system.mean, rssSigma: calculation.system.rssSigma,
          worstCaseLower: calculation.system.worstCaseLower, worstCaseUpper: calculation.system.worstCaseUpper,
          ...(calculation.capability.cp === undefined ? {} : { cp: calculation.capability.cp }),
          ...(calculation.capability.cpk === undefined ? {} : { cpk: calculation.capability.cpk }),
          ...(calculation.capability.yield === undefined ? {} : { yield: calculation.capability.yield }),
          ...(calculation.capability.totalDpm === undefined ? {} : { dpm: calculation.capability.totalDpm }) },
      };
    }),
  };
  return { markdown: reportMarkdown, reportSummary, projection };
}

function v4SelectedStatusText(status) {
  if (status === "baseline_meets_target") return "Baseline meets target";
  if (status === "step1_centered") return "Step 1 centered";
  if (status === "step2_tolerance_optimized") return "Step 2 tolerance optimized";
  if (status === "step3_specification_relaxed_pending_approval") return "Step 3 specification relaxed pending approval";
  return "No validated optimized result";
}

function reportInterpretationText(value) {
  return normalizeInterpretationText(value, NA);
}

function specificationRangeText(lower, upper, unit) {
  return `[${fixedEngineering(lower, unit)}, ${fixedEngineering(upper, unit)}]`;
}

function renderV4OptimizationModules(worksheet, unit, catalog) {
  const baseline = worksheet.f6Worksheet.baselineResult;
  const selected = worksheet.f6Worksheet.selectedResult.snapshot;
  const contributors = [...selected.factors].sort((left, right) => right.contribution - left.contribution);
  const lines = [
    "",
    `## ${catalog.center}`,
    "",
    `- Design Nominal: ${fixedEngineering(baseline.system.designNominal, unit)}`,
    `- Adjusted Mean: ${fixedEngineering(selected.system.mean, unit)}`,
    `- Offset: ${fixedEngineering(selected.system.meanOffset, unit)}`,
    `- Selected Result: ${v4SelectedStatusText(worksheet.f6Worksheet.selectedResult.status)}`,
    "",
    `## ${catalog.contributors}`,
    "",
    `| ${catalog.rank} | ${catalog.factor} | One Sigma | Variance Contribution | ${catalog.priority} | ${catalog.guidance} |`,
    "|---:|---|---:|---:|---|---|",
  ];
  contributors.forEach((item, index) => lines.push(row([
    index + 1,
    clean(item.factor.factorName),
    engineeringText(item.sigma, item.factor.unit),
    percentText(item.contribution),
    v3PriorityLabel(index + 1, contributors.length, catalog),
    index < 3 ? "Review tolerance range" : NA,
  ])));
  lines.push("", catalog.topThree);

  const failedSides = [
    worksheet.f6Worksheet.selectedResult.status === "step3_specification_relaxed_pending_approval"
      && !nearlyEqual(baseline.capability.lowerSpecLimit, selected.capability.lowerSpecLimit)
      ? ["lower", baseline.capability.lowerSpecLimit, selected.capability.lowerSpecLimit]
      : undefined,
    worksheet.f6Worksheet.selectedResult.status === "step3_specification_relaxed_pending_approval"
      && !nearlyEqual(baseline.capability.upperSpecLimit, selected.capability.upperSpecLimit)
      ? ["upper", baseline.capability.upperSpecLimit, selected.capability.upperSpecLimit]
      : undefined,
  ].filter(Boolean);
  if (baseline.capability.status === "FAIL") {
    lines.push(
      "",
      `## ${catalog.specifications}`,
      "",
    );
    const currentRange = specificationRangeText(
      baseline.capability.lowerSpecLimit,
      baseline.capability.upperSpecLimit,
      unit,
    );
    if (failedSides.length > 0) {
      const proposedRange = specificationRangeText(
        selected.capability.lowerSpecLimit,
        selected.capability.upperSpecLimit,
        unit,
      );
      lines.push(
        `| ${catalog.side} | ${catalog.currentLimit} | ${catalog.proposedLimit} | ${catalog.targetCpk} | ${catalog.approval} |`,
        "|---|---:|---:|---:|---|",
        ...failedSides.map(([side, currentLimit, proposedLimit]) => row([
          side,
          numberText(currentLimit),
          numberText(proposedLimit),
          numberText(baseline.capability.targetCpk),
          catalog.approvalRequired,
        ])),
        "",
        `- Summary: Adjust the specification range from ${currentRange} to ${proposedRange}, subject to ME and requirement-owner approval.`,
      );
    } else if (["step1_centered", "step2_tolerance_optimized"].includes(worksheet.f6Worksheet.selectedResult.status)) {
      lines.push(
        `- Current Range: ${currentRange}`,
        "- Proposed Range: No change proposed",
        `- Summary: Retain the current specification range ${currentRange}; ${v4SelectedStatusText(worksheet.f6Worksheet.selectedResult.status)} meets Target Cpk without a requirement change.`,
      );
    } else {
      lines.push(
        `- Current Range: ${currentRange}`,
        "- Proposed Range: No validated specification proposal",
        "- Summary: No validated specification change is available; resolve the optimization blocker before changing the requirement.",
      );
    }
  }
  return lines;
}

function renderF6V4Worksheet(worksheet, interpretation, ordinal, catalog, imageLinks, analysisContext, f3Ado) {
  const prefix = `3-${ordinal}`;
  const calculation = worksheet.f4Calculation;
  const unit = calculation.factors[0]?.unit ?? "unit";
  const projection = createF6ReportProjection({ calculation, inputResolution: 1e-12 });
  const verifiedRelativePath = imageLinks?.get(worksheet.worksheetName);
  const relativePath = verifiedRelativePath ?? interpretation?.request?.image?.artifactPath;
  const imageLink = typeof relativePath === "string"
    && (verifiedRelativePath !== undefined || (!relativePath.includes("..") && !/^[A-Za-z]:|^[/\\]/.test(relativePath)))
    ? `[${catalog.openImage}](<${encodeURI(relativePath.replace(/\\/g, "/"))}>)`
    : NA;
  const factors = v3CompleteFactorRows(worksheet, interpretation);
  const lines = [
    `<a id="worksheet-${ordinal}"></a>`,
    "",
    `# ${prefix} ${catalog.worksheet}: ${clean(worksheet.worksheetName)}`,
    "",
    `## ${catalog.factors}`,
    "",
    ...renderCompleteFactorTable(readyFactorTableRows(factors)),
    "",
    ...renderProcessAndRequirements(worksheet, analysisContext, f3Ado),
    "",
    `## ${catalog.image}`,
    "",
    imageLink,
    "",
    reportInterpretationText(interpretation?.imageTableInterpretation),
    "",
    `*${MODEL_RISK_DISCLOSURE}*`,
    "",
    `## ${catalog.results}`,
    "",
    "| Requirement | Value |",
    "|---|---:|",
    row(["Design Nominal", engineeringText(calculation.system.designNominal, unit)]),
    row(["LSL", engineeringText(calculation.capability.lowerSpecLimit, unit)]),
    row(["USL", engineeringText(calculation.capability.upperSpecLimit, unit)]),
    row(["Target Cpk", numberText(calculation.capability.targetCpk)]),
    row(["Evaluation Level", evaluationLevelText(calculation.capability.targetSigmaLevel)]),
    "",
    "| Metric | Lower | Upper | Minimum Margin | Result |",
    "|---|---:|---:|---:|---|",
    ...statisticalRangeRows(projection, calculation, unit),
    "",
    "| Capability Metric | Value | Result |",
    "|---|---:|---|",
    row(["Predictive Cp", numberText(calculation.capability.cp), clean(calculation.capability.cpStatus)]),
    row(["Predictive CpkL", numberText(calculation.capability.lowerCpk), clean(calculation.capability.lowerCpkStatus)]),
    row(["Predictive CpkU", numberText(calculation.capability.upperCpk), clean(calculation.capability.upperCpkStatus)]),
    row(["Predictive Cpk", numberText(calculation.capability.cpk), clean(calculation.capability.status)]),
    row(["Predicted Yield", percentText(calculation.capability.yield), NA]),
    row(["Predicted DPM", numberText(calculation.capability.totalDpm), NA]),
  ];

  lines.push(...renderV4OptimizationModules(worksheet, unit, catalog));
  return lines;
}

function createF6V4Report({ f2Report, f3Report, f4Report, f5Report, f6Optimization, modelInterpretation, analysisContext, analysisRequestContext, blockedWorksheetDetailsByName = new Map(), generatedAt, imageLinks }) {
  const worksheets = buildWorksheetPolicyInputs({
    f2Report,
    f3Report,
    f4Report,
    f5Report,
    f6Optimization,
    blockedWorksheetDetailsByName,
  });
  const interpretations = modelInterpretationByWorksheet({ f6Optimization, modelInterpretation });
  const language = "en";
  const catalog = F6_V3_REPORT_CATALOG.en;
  const f3Ado = adoTraceabilityForReport(f3Report);
  const worksheetDispositions = worksheets.map(({ worksheetName, disposition }) => ({ worksheetName, disposition }));
  const workbookDisposition = worstDisposition(worksheetDispositions.map(({ disposition }) => disposition));
  const reportSummary = { workbookDisposition, worksheetDispositions };

  const markdown = [
    `# ${catalog.title}`,
    "",
    ...renderF6V3DocumentOverview({ f2Report, analysisContext, analysisRequestContext }, catalog),
    "",
    ...renderF6V3WorkbookSummary(worksheets, catalog),
  ];

  worksheets.forEach((worksheet, index) => markdown.push(
    "",
    ...((worksheet.f2Worksheet.status === "ready" && worksheet.blocker === undefined)
      ? renderF6V4Worksheet(worksheet, interpretations.get(worksheet.worksheetName), index + 1, catalog, imageLinks, analysisContext, f3Ado)
      : renderF6V3BlockedWorksheet(worksheet, index + 1, catalog, language)),
  ));

  const reportMarkdown = `${markdown.join("\n")}\n`;
  if (/\p{Script=Han}/u.test(reportMarkdown)) {
    throw new Error("Invalid F6 final report input: English-only report content is required.");
  }
  const projection = {
    schemaVersion: "ta-engineering-report-projection-v1",
    title: catalog.title,
    workbookDisposition,
    worksheetDispositions,
    workbook: {
      fileName: f2Report.workbook.fileName,
      ...(f2Report.workbook.revision === undefined ? {} : { revision: f2Report.workbook.revision }),
      contentHash: f2Report.workbook.contentHash,
    },
    worksheets: worksheets.map((worksheet) => {
      const calculation = worksheet.f4Calculation;
      const base = {
        worksheetName: worksheet.worksheetName,
        toleranceLoopDescription: clean(worksheet.f2Worksheet.toleranceLoopDescription, NA),
        disposition: worksheet.disposition,
        requiredAction: requiredAction(worksheet),
        findings: [worksheet.f2Worksheet.status === "ready"
          ? v3PrimaryFinding(worksheet)
          : blockedWorksheetFinding(worksheet, language)],
        assumptions: [],
        clarifications: [],
        gatingEvidenceReferences: worksheet.f2Worksheet.status === "ready"
          ? [`F4:${worksheet.worksheetName}`, `F5-multimodal:${worksheet.worksheetName}`]
          : [`F2:${worksheet.worksheetName}`],
      };
      if (calculation === undefined || worksheet.f6Worksheet === undefined) return base;
      const processChecks = createWorksheetProcessChecks(worksheet, analysisContext, f3Ado)
        .map((check) => processCheckProjection(check, f3Ado));
      return {
        ...base,
        processChecks,
        metrics: {
          mean: worksheet.f6Worksheet.baselineResult.system.mean,
          rssSigma: worksheet.f6Worksheet.baselineResult.system.rssSigma,
          worstCaseLower: worksheet.f6Worksheet.baselineResult.system.worstCaseLower,
          worstCaseUpper: worksheet.f6Worksheet.baselineResult.system.worstCaseUpper,
          cpk: worksheet.f6Worksheet.baselineResult.capability.cpk,
          yield: worksheet.f6Worksheet.baselineResult.capability.yield,
          dpm: worksheet.f6Worksheet.baselineResult.capability.totalDpm,
        },
      };
    }),
  };
  return { markdown: reportMarkdown, reportSummary, projection };
}

function indexCalculationsByWorksheetName(calculations) {
  const byName = new Map();
  const counts = new Map();

  for (const calculation of calculations) {
    const worksheetName = calculation.worksheetSelection.worksheetName;
    byName.set(worksheetName, calculation);
    counts.set(worksheetName, (counts.get(worksheetName) ?? 0) + 1);
  }

  return { byName, counts };
}

function hasOpenF5Review(f5Worksheet) {
  const hasOpenSignal = f5Worksheet.statements.some((statement) => {
    if (statement.type !== "SIGNAL" || statement.content.requiresEngineeringReview !== true) {
      return false;
    }

    if ("visualEvidence" in statement.content) {
      return statement.content.visualEvidence.reviewStatus !== "confirmed";
    }

    if ("observationEvidence" in statement.content) {
      return statement.content.observationEvidence.some((evidence) => evidence.reviewStatus !== "confirmed");
    }

    return false;
  });
  const hasOpenClarification = f5Worksheet.clarifications.length > 0;
  const hasOpenAssumption = f5Worksheet.assumptions.some((assumption) => assumption.status !== "confirmed");
  const hasOpenImageReview = f5Worksheet.statements.some((statement) => statement.type === "FACT"
    && statement.content.provenanceKind === "image_observation"
    && statement.content.reviewStatus !== "confirmed");

  return hasOpenSignal || hasOpenClarification || hasOpenAssumption || hasOpenImageReview;
}

function parseOrThrow(schema, value, label) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid F6 final report input: ${label}.`);
  }
  return parsed.data;
}

function failInvalid(label) {
  throw new Error(`Invalid F6 final report input: ${label}.`);
}

function nearlyEqual(left, right) {
  return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function f2WorksheetMatchesHandoff(worksheet, handoff, workbookContentHash) {
  try {
    return isDeepStrictEqual(createF4Handoff({ workbookContentHash, worksheet }), handoff);
  } catch {
    return false;
  }
}

function sameDimId(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return String(left) === String(right);
}

function assertWorkbookIdentity({ f2Report, f3Report, f4Report, f5Report, f6Optimization }) {
  const workbook = f2Report.workbook;
  const rootIdentities = [
    [f3Report.workbook?.fileName, f3Report.workbook?.contentHash],
    [f4Report.source?.workbookFileName, f4Report.source?.workbookContentHash],
    [f5Report.workbook?.fileName, f5Report.workbook?.contentHash],
    [f6Optimization.workbook?.fileName, f6Optimization.workbook?.contentHash],
  ];

  if (rootIdentities.some(([fileName, contentHash]) => (
    fileName !== undefined && fileName !== workbook.fileName)
    || (contentHash !== undefined && contentHash !== workbook.contentHash))) {
    failInvalid("workbook identity");
  }
}

function factorIdentitiesWithoutTrace(calculation) {
  return calculation.factors.map((factor) => {
    const identity = structuredClone(factor);
    delete identity.trace;
    return identity;
  });
}

function assertBaselineIdentity(calculation, f6Worksheet) {
  const baselineIdentity = f6Worksheet.baselineIdentity;
  if (calculation.calculationVersion !== baselineIdentity.calculationVersion
    || calculation.projectReference !== baselineIdentity.projectReference
    || calculation.runReference !== baselineIdentity.runReference
    || calculation.workbookContentHash !== baselineIdentity.workbookContentHash
    || calculation.worksheetSelection.worksheetName !== baselineIdentity.worksheetName
    || calculation.worksheetSelection.tableId !== baselineIdentity.tableId
    || (f6Worksheet.tableId !== undefined && f6Worksheet.tableId !== calculation.worksheetSelection.tableId)) {
    failInvalid("baseline identity");
  }

  if (baselineIdentity.factorCount !== undefined
    && calculation.factorCount !== baselineIdentity.factorCount) failInvalid("baseline identity");
  if (baselineIdentity.factors !== undefined
    && JSON.stringify(factorIdentitiesWithoutTrace(calculation)) !== JSON.stringify(baselineIdentity.factors)) failInvalid("baseline identity");
  if (baselineIdentity.system !== undefined
    && JSON.stringify(calculation.system) !== JSON.stringify(baselineIdentity.system)) failInvalid("baseline identity");
  if (baselineIdentity.capability !== undefined
    && JSON.stringify(calculation.capability) !== JSON.stringify(baselineIdentity.capability)) failInvalid("baseline identity");

  const expectedMetrics = {
    mean: calculation.system.mean,
    rssSigma: calculation.system.rssSigma,
    worstCaseLower: calculation.system.worstCaseLower,
    worstCaseUpper: calculation.system.worstCaseUpper,
    cp: calculation.capability.cp,
    cpk: calculation.capability.cpk,
    yield: calculation.capability.yield,
    dpm: calculation.capability.totalDpm,
  };
  if (f6Worksheet.baselineMetrics !== undefined) {
    for (const [field, expected] of Object.entries(expectedMetrics)) {
      if (expected !== undefined
        && f6Worksheet.baselineMetrics[field] !== undefined
        && !nearlyEqual(expected, f6Worksheet.baselineMetrics[field])) {
        failInvalid("baseline metrics");
      }
    }
  }
}

function assertWorksheetIdentity({ worksheetName, f2Worksheet, f2Handoff, f3Worksheet, f4Calculation, f4CalculationIndex, f4Report, f5Worksheet, f6Worksheet, workbookContentHash }) {
  if (!f2WorksheetMatchesHandoff(f2Worksheet, f2Handoff, workbookContentHash)) {
    failInvalid("worksheet identity");
  }

  const expectedProjectReference = `f4-${workbookContentHash.slice(0, 16)}`;
  const expectedRunReference = `${f4Report.runId}-${f4CalculationIndex}`;
  if (f4Calculation.projectReference !== expectedProjectReference
    || f4Calculation.runReference !== expectedRunReference
    || f4Calculation.recommendation.criticality !== "none") {
    failInvalid("calculation identity");
  }

  let replay;
  try {
    replay = createCalculation(createCalculationRequestFromF4Handoff({
      handoff: f2Handoff,
      projectReference: expectedProjectReference,
      runReference: expectedRunReference,
      criticality: "none",
    }));
  } catch {
    failInvalid("calculation identity");
  }

  if (!isDeepStrictEqual(replay, f4Calculation)
    || !isDeepStrictEqual(f3Worksheet.rows, f5Worksheet.governanceRows)
    || !isDeepStrictEqual(f4Calculation, f5Worksheet.calculationResult)) {
    failInvalid("worksheet identity");
  }

  if (f4Calculation.worksheetSelection.worksheetName !== worksheetName
    || f5Worksheet.calculationResult.worksheetSelection.worksheetName !== worksheetName
    || f6Worksheet.baselineIdentity.worksheetName !== worksheetName) {
    failInvalid("worksheet identity");
  }

  assertBaselineIdentity(f4Calculation, f6Worksheet);
}

function resolveWorksheetDisposition({ f2Worksheet, f3Worksheet, f4Calculation, f5Worksheet }) {
  const blocked = f2Worksheet.status !== "ready";
  const blockingDataGap = Array.isArray(f2Worksheet.missingFieldSummary) && f2Worksheet.missingFieldSummary.length > 0;
  const calculation = f4Calculation;
  const capability = calculation?.capability;
  const supportedSpecificationFailure = Array.isArray(f2Worksheet.systemSpecificationIssues) && f2Worksheet.systemSpecificationIssues.length > 0;
  const governanceRequired = f3Worksheet.rows.some(({ governanceStatus }) => governanceStatus !== "complete");
  const openF5Review = hasOpenF5Review(f5Worksheet);

  if (blocked || calculation == null || capability == null || blockingDataGap) return "FAIL";
  if (supportedSpecificationFailure || capability.status === "FAIL") return "INCOMPLETE";
  if (governanceRequired || openF5Review) return "CONDITIONAL_PASS";
  return "PASS";
}

function buildWorksheetPolicyInputs({ f2Report, f3Report, f4Report, f5Report, f6Optimization, blockedWorksheetDetailsByName = new Map() }) {
  assertWorkbookIdentity({ f2Report, f3Report, f4Report, f5Report, f6Optimization });
  assertReportScope(f2Report, f6Optimization, blockedWorksheetDetailsByName);
  const blockedScopeNameSet = new Set([
    ...f6Optimization.provenance.reportScope.blockedWorksheetNames,
    ...blockedWorksheetDetailsByName.keys(),
  ]);
  const readyNames = f6Optimization.provenance.reportScope.worksheetNames
    .filter((worksheetName) => !blockedScopeNameSet.has(worksheetName));

  assertExactWorksheetSet(
    f3Report.worksheets.map(({ worksheetName }) => worksheetName),
    f2Report.worksheets.filter(({ status }) => status === "ready").map(({ worksheetName }) => worksheetName),
    "f3Report",
  );
  assertExactWorksheetSet(
    f5Report.worksheets
      .filter(({ status }) => status === "completed")
      .map(({ worksheetName }) => worksheetName)
      .filter((worksheetName) => !blockedScopeNameSet.has(worksheetName)),
    readyNames,
    "f5Report",
  );
  assertExactWorksheetSet(
    f6Optimization.worksheets
      .map(({ worksheetName }) => worksheetName)
      .filter((worksheetName) => !blockedScopeNameSet.has(worksheetName)),
    readyNames,
    "f6Optimization",
  );

  const f3ByName = indexByWorksheetName(f3Report.worksheets);
  const f5ByName = indexByWorksheetName(
    f5Report.worksheets.filter((worksheet) => worksheet.status === "completed"),
  );
  const f6ByName = indexByWorksheetName(f6Optimization.worksheets);
  const { byName: f4ByName, counts: f4Counts } = indexCalculationsByWorksheetName(f4Report.calculations);
  const f2ReadyByName = indexByWorksheetName(f2Report.worksheets.filter(({ status }) => status === "ready"));
  const f2HandoffByName = indexByWorksheetName(f2Report.f4Handoffs);
  const f4CalculationIndexes = new Map(f4Report.calculations.map((calculation, index) => [
    calculation.worksheetSelection.worksheetName,
    index + 1,
  ]));

  for (const worksheetName of readyNames) {
    if (f4Counts.get(worksheetName) !== 1) failInvalid("f4Report");
  }

  for (const worksheetName of readyNames) {
    assertWorksheetIdentity({
      worksheetName,
      f2Worksheet: f2ReadyByName.get(worksheetName),
      f2Handoff: f2HandoffByName.get(worksheetName),
      f3Worksheet: f3ByName.get(worksheetName),
      f4Calculation: f4ByName.get(worksheetName),
      f4CalculationIndex: f4CalculationIndexes.get(worksheetName),
      f4Report,
      f5Worksheet: f5ByName.get(worksheetName),
      f6Worksheet: f6ByName.get(worksheetName),
      workbookContentHash: f2Report.workbook.contentHash,
    });
  }

  return f2Report.worksheets.map((f2Worksheet) => {
    const worksheetName = f2Worksheet.worksheetName;
    const blockedByScope = blockedScopeNameSet.has(worksheetName);
    const blocker = blockedWorksheetDetailsByName.get(worksheetName);

    if (f2Worksheet.status !== "ready" || blockedByScope) {
      return {
        worksheetName,
        disposition: "FAIL",
        f2Worksheet: blockedByScope && f2Worksheet.status === "ready"
          ? { ...f2Worksheet, status: "blocked" }
          : f2Worksheet,
        blocker,
      };
    }

    const f3Worksheet = f3ByName.get(worksheetName);
    const f4Calculation = f4ByName.get(worksheetName);
    const f5Worksheet = f5ByName.get(worksheetName);
    const f6Worksheet = f6ByName.get(worksheetName);

    if (f4Counts.get(worksheetName) !== 1
      || f3Worksheet === undefined
      || f4Calculation === undefined
      || f5Worksheet === undefined
      || f6Worksheet === undefined) {
      return {
        worksheetName,
        disposition: "FAIL",
        f2Worksheet,
      };
    }

    return {
      worksheetName,
      disposition: resolveWorksheetDisposition({ f2Worksheet, f3Worksheet, f4Calculation, f5Worksheet }),
      f2Worksheet,
      f3Worksheet,
      f4Calculation,
      f5Worksheet,
      f6Worksheet,
      blocker,
    };
  });
}

function clean(value, fallback = NA) {
  if (value === null || value === undefined || value === "") return fallback;
  return safeText(value);
}

function paragraph(value, fallback = NA) {
  if (value === null || value === undefined || value === "") return fallback;
  return safeText(String(value).replace(/\s+/gu, " ").trim());
}

function dispositionText(value) {
  return F6_DISPOSITION_RANK[value] === undefined ? "FAIL" : value;
}

function dispositionComment(value) {
  if (value === "PASS") return "Pass";
  if (value === "CONDITIONAL_PASS") return "Need Review";
  return "Fail";
}

function numberText(value, fallback = NA) {
  if (!Number.isFinite(value)) return fallback;
  return Number(value.toFixed(6)).toString();
}

function engineeringText(value, unit, fallback = NA) {
  if (!Number.isFinite(value)) return fallback;
  try {
    return formatEngineering(value, unit || "unit", 6).replace(/\.0+(?=\s)/, "");
  } catch {
    return `${numberText(value)} ${clean(unit || "unit")}`;
  }
}

function percentText(value, fallback = NA) {
  if (!Number.isFinite(value)) return fallback;
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return formatPercent(percent, 1);
}

function row(values) {
  return `| ${values.join(" | ")} |`;
}

function sourceCell(specification, field) {
  return clean(specification?.[field]?.sourceCell, NA);
}

function specValue(specification, field) {
  return specification?.[field]?.actualValue;
}

function topFactor(calculation) {
  return [...calculation.factors].sort((left, right) => right.contribution - left.contribution)[0];
}

function factorGovernanceBySource(f3Worksheet) {
  return new Map(f3Worksheet.rows.map((item) => [
    `${item.source.tableId}:${item.source.sourceRow}`,
    item,
  ]));
}

function reviewStatus(analysisContext) {
  return clean(analysisContext?.reviewedBy ?? analysisContext?.reviewer ?? analysisContext?.review?.reviewedBy, "PENDING");
}

function primaryFinding(context) {
  if (context.blocker !== undefined) return clean(context.blocker.summary, INSUFFICIENT_EVIDENCE);
  if (context.disposition === "PASS") return "数值、输入和工程复核均已通过。";
  if (context.f2Worksheet.status !== "ready") return "缺少必填输入、图片或有效计算，当前 worksheet 无法完成分析。";
  if (context.disposition === "INCOMPLETE") return "计算已完成，但 CpkL、CpkU 或规格范围未达到 worksheet 要求。";
  if (context.disposition === "CONDITIONAL_PASS") return "数值达到要求，但仍需补齐 Drawing Number、DIM ID 或完成图像与工程复核。";
  return INSUFFICIENT_EVIDENCE;
}

function v3PrimaryFinding(context) {
  const calculation = context.f4Calculation;
  if (calculation === undefined) return "Required input, image, or calculation evidence is blocked; a complete analysis cannot be formed.";

  const lowerCpk = calculation.capability.lowerCpk;
  const upperCpk = calculation.capability.upperCpk;
  const targetCpk = calculation.capability.targetCpk;
  const failedSides = [
    calculation.capability.lowerCpkStatus === "FAIL" ? `CpkL ${numberText(lowerCpk)}` : undefined,
    calculation.capability.upperCpkStatus === "FAIL" ? `CpkU ${numberText(upperCpk)}` : undefined,
  ].filter(Boolean);
  if (failedSides.length > 0) {
    return `${failedSides.join(" and ")} ${failedSides.length === 1 ? "does" : "do"} not meet Target Cpk ${numberText(targetCpk)}.`;
  }

  if (context.disposition === "INCOMPLETE") {
    return "The statistical or worst-case range does not meet the worksheet specification.";
  }

  const governanceRows = context.f3Worksheet.rows;
  const missingDrawing = governanceRows.filter(({ drawingNumber }) => drawingNumber == null || drawingNumber === "").length;
  const missingDimId = governanceRows.filter(({ dimId }) => dimId == null || dimId === "").length;
  const openDrawingDefinition = governanceRows.some(({ governanceStatus }) => governanceStatus !== "complete");
  if (context.disposition === "CONDITIONAL_PASS" || missingDrawing > 0 || missingDimId > 0 || openDrawingDefinition) {
    return "Drawing Numbers, drawing dimension definition is missing.";
  }

  return `CpkL ${numberText(lowerCpk)} and CpkU ${numberText(upperCpk)} meet Target Cpk ${numberText(targetCpk)}; required inputs and reviews are complete.`;
}

const BLOCKED_FINDING_CATALOG = {
  en: {
    fields: {
      factorName: "Factor Description",
      nominalValue: "Design Nominal",
      upperTolerance: "+ Tolerance",
      lowerTolerance: "- Tolerance",
      unit: "Unit",
      distribution: "Distribution",
      longTermSafetyFactor: "Long Term/Safety Factor",
      partName: "Part Name",
      partCategory: "Part Category",
    },
    specificationFields: {
      designNominal: "Design Nominal",
      lowerSpecLimit: "Lower Spec Limit",
      upperSpecLimit: "Upper Spec Limit",
      targetSigmaLevel: "Target Sigma Level",
    },
    calculationIssues: {
      factor_tables_missing: "Factor table is missing",
      factor_table_has_no_rows: "Factor table has no active rows",
      factor_ordinal_missing: "Factor ordinal is missing",
      factor_ordinal_duplicate: "Factor ordinal is duplicated",
      factor_tolerance_range_invalid: "Factor tolerance range is invalid",
      long_term_safety_factor_invalid: "Long Term/Safety Factor is invalid",
      sigma_level_invalid: "Sigma Level is invalid",
      f4_calculation_not_possible: "A valid TA calculation cannot be formed",
    },
    row: "Row",
    rows: "Rows",
    rowJoiner: " and ",
    missing: "is missing.",
    imageMissing: "Tolerance path image is missing.",
    generic: "The worksheet is blocked by invalid required input, image, or calculation evidence.",
  },
  zh: {
    fields: {
      factorName: "Factor Description",
      nominalValue: "Design Nominal",
      upperTolerance: "+ Tolerance",
      lowerTolerance: "- Tolerance",
      unit: "Unit",
      distribution: "Distribution",
      longTermSafetyFactor: "Long Term/Safety Factor",
      partName: "Part Name",
      partCategory: "Part Category",
    },
    specificationFields: {
      designNominal: "Design Nominal",
      lowerSpecLimit: "Lower Spec Limit",
      upperSpecLimit: "Upper Spec Limit",
      targetSigmaLevel: "Target Sigma Level",
    },
    calculationIssues: {
      factor_tables_missing: "缺少 Factor 表",
      factor_table_has_no_rows: "Factor 表没有有效行",
      factor_ordinal_missing: "缺少 Factor 序号",
      factor_ordinal_duplicate: "Factor 序号重复",
      factor_tolerance_range_invalid: "Factor 公差范围无效",
      long_term_safety_factor_invalid: "Long Term/Safety Factor 无效",
      sigma_level_invalid: "Sigma Level 无效",
      f4_calculation_not_possible: "无法形成有效的 TA 计算",
    },
    row: "Row",
    rows: "Rows",
    rowJoiner: "、",
    missing: "缺失。",
    imageMissing: "缺少公差路径图片。",
    generic: "worksheet 因必填输入、图片或计算证据无效而被阻断。",
  },
};

function formatSourceRows(sourceRows, catalog) {
  const rows = [...new Set(sourceRows)].sort((left, right) => left - right);
  if (rows.length === 0) return "";
  return `${rows.length === 1 ? catalog.row : catalog.rows} ${rows.join(catalog.rowJoiner)}: `;
}

function blockedWorksheetFinding(context, language) {
  const catalog = BLOCKED_FINDING_CATALOG[language] ?? BLOCKED_FINDING_CATALOG.en;
  const findings = [];
  for (const item of context.f2Worksheet.missingFieldSummary ?? []) {
    if (item.field === "tolerancePathImage") continue;
    const field = catalog.fields[item.field] ?? clean(item.field);
    findings.push(`${formatSourceRows(item.sourceRows, catalog)}${field} ${catalog.missing}`);
  }
  for (const issue of context.f2Worksheet.systemSpecificationIssues ?? []) {
    const field = catalog.specificationFields[issue.field] ?? clean(issue.field);
    findings.push(`${field}: ${clean(issue.reasonCode)}.`);
  }
  for (const issue of context.f2Worksheet.f4CalculabilityIssues ?? []) {
    const message = catalog.calculationIssues[issue.reasonCode] ?? clean(issue.reasonCode);
    const prefix = issue.sourceRow === undefined ? "" : `${catalog.row} ${issue.sourceRow}: `;
    findings.push(`${prefix}${message}.`);
  }
  if (context.f2Worksheet.tolerancePathImageStatus !== "available") findings.push(catalog.imageMissing);
  if (context.blocker !== undefined) {
    findings.push(`Multimodal blocker (${clean(context.blocker.reasonCode)}): ${clean(context.blocker.summary)}.`);
  }
  return findings.length === 0 ? catalog.generic : findings.join(" ");
}

function reportTimestamp(value, utcOffsetMinutes) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return NOT_PROVIDED;
  const pad = (part) => String(part).padStart(2, "0");
  const offsetMinutes = Number.isInteger(utcOffsetMinutes) ? utcOffsetMinutes : -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetRemainder = Math.abs(offsetMinutes) % 60;
  const offset = `${offsetSign}${offsetHours}${offsetRemainder === 0 ? "" : `:${pad(offsetRemainder)}`}`;
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())} (UTC${offset})`;
}

function requestTimestamp(analysisRequestContext) {
  return reportTimestamp(analysisRequestContext.requestedAt, analysisRequestContext.utcOffsetMinutes);
}

function requiredAction(context) {
  if (context.blocker !== undefined) return `Resolve ${PRODUCT_CAPABILITIES.analysisInterpretation} evidence before ${PRODUCT_CAPABILITIES.reportEnhancement}.`;
  if (context.f2Worksheet.status !== "ready") return `Resolve ${PRODUCT_CAPABILITIES.dataCleaning} evidence before ${PRODUCT_CAPABILITIES.calculationEngine}, ${PRODUCT_CAPABILITIES.analysisInterpretation}, and ${PRODUCT_CAPABILITIES.reportEnhancement}.`;
  if (context.disposition === "PASS") return "None";
  if (context.disposition === "CONDITIONAL_PASS") return `Close ${PRODUCT_CAPABILITIES.drawingGovernance} and ${PRODUCT_CAPABILITIES.analysisInterpretation} review items.`;
  return "Engineering review required before release decision";
}

function renderDocumentControl(context) {
  const readyCount = context.f2Report.worksheets.filter(({ status }) => status === "ready").length;
  const blockedCount = context.f2Report.worksheets.length - readyCount;
  return [
    "# 1. 文档控制 Document Control",
    "",
    "| Field | Value | Source |",
    "|---|---|---|",
    row(["Source Workbook", clean(context.f2Report.workbook.fileName), "F1/F2 workbook identity"]),
    row(["Workbook Revision", clean(context.f2Report.workbook.revision, NA), "F1 workbook metadata"]),
    row(["Selected Worksheet Count", clean(context.f2Report.worksheets.length), "F2 selected scope"]),
    row(["Ready / Blocked Worksheet Count", `${readyCount} / ${blockedCount}`, "F2 handoff status"]),
    row(["Analysis Requested At", requestTimestamp(context.analysisRequestContext), "Analysis request context"]),
    row(["Reviewed By", reviewStatus(context.analysisContext), "Explicit review record or PENDING"]),
  ];
}

function renderWorkbookOverview(context) {
  const lines = [
    "# 2. Workbook 决策总览",
    "",
    "| Worksheet | Tolerance Loop Description | Key Finding | Disposition |",
    "|---|---|---|---|",
  ];

  for (const worksheet of context.worksheets) {
    lines.push(row([
      clean(worksheet.worksheetName),
      clean(worksheet.f2Worksheet.toleranceLoopDescription, NA),
      clean(primaryFinding(worksheet)),
      dispositionText(worksheet.disposition),
    ]));
  }
  lines.push(
    "",
    "- PASS：数值、输入和工程复核均已通过。",
    "- CONDITIONAL_PASS：数值达到要求，但仍需补齐标识或完成工程复核。",
    "- INCOMPLETE：计算链有效，但数值结果未达到明确工程要求。",
    "- FAIL：输入、图片或计算链被阻断，当前无法形成完整分析。",
  );
  return lines;
}

function renderExecutiveSummary(worksheet) {
  const calculation = worksheet.f4Calculation;
  const top = calculation === undefined ? undefined : topFactor(calculation);
  const topContributor = top === undefined ? NA : `${clean(top.factorName)} (${percentText(top.contribution)})`;
  const characteristic = worksheet.f2Worksheet.toleranceLoopDescription;
  return [
    "## 3.1 执行摘要",
    "",
    "| Item | Result | Evidence |",
    "|---|---|---|",
    row(["Tolerance Loop Description", clean(characteristic), "F2/F3"]),
    row(["Final Disposition", dispositionText(worksheet.disposition), "F2-F5 governed evidence"]),
    row(["Top Contributor", topContributor, "F4 contribution result"]),
    row(["Required Action", clean(requiredAction(worksheet)), "F5 clarification / engineering review"]),
    "",
    "**一句话结论：**  ",
    `${clean(primaryFinding(worksheet))} 首要贡献因子为 ${topContributor}，请按 Required Action 完成下一步；贡献率不等于已确认的物理根因。`,
  ];
}

function renderRequirements(worksheet) {
  const specification = worksheet.f2Worksheet.systemSpecification;
  const calculation = worksheet.f4Calculation;
  const unit = calculation?.factors?.[0]?.unit ?? "unit";
  return [
    "## 3.2 分析目标与要求",
    "",
    "| Requirement | Value | Source |",
    "|---|---:|---|",
    row(["Design Nominal", engineeringText(calculation?.system?.designNominal, unit), "F4 system.designNominal"]),
    row(["LSL", engineeringText(specValue(specification, "lowerSpecLimit"), unit), `F2 ${sourceCell(specification, "lowerSpecLimit")}`]),
    row(["USL", engineeringText(specValue(specification, "upperSpecLimit"), unit), `F2 ${sourceCell(specification, "upperSpecLimit")}`]),
    row(["Target Cpk", numberText(calculation?.capability?.targetCpk), "F2/F4 capability.targetCpk"]),
    row(["Evaluation Level", evaluationLevelText(calculation?.capability?.targetSigmaLevel, "σ"), "F2/F4 capability.targetSigmaLevel"]),
  ];
}

function renderToleranceImage(worksheet) {
  const relativePath = worksheet.f3Worksheet?.rows?.[0]?.imageReference?.relativePath;
  const link = typeof relativePath === "string" && !relativePath.includes("..") && !/^[A-Za-z]:|^[/\\]/.test(relativePath)
    ? `<${encodeURI(relativePath.replace(/\\/g, "/"))}>`
    : undefined;
  return [
    "## 3.3 Tolerance Path Image",
    "",
    link === undefined ? NA : `[Open tolerance path image](${link})`,
  ];
}

function renderInputs(worksheet) {
  const calculation = worksheet.f4Calculation;
  const governanceBySource = factorGovernanceBySource(worksheet.f3Worksheet);
  const lines = [
    "## 3.4 输入数据",
    "",
    "| Row | Factor Description (TA Loop) | Drawing Number | DIM ID | Design Nominal | Mean | +Tol | -Tol | Distribution | Sigma Level | 1σ | Source |",
    "|---:|---|---|---|---:|---:|---:|---:|---|---:|---:|---|",
  ];

  for (const factor of calculation.factors) {
    const governance = governanceBySource.get(`${factor.source.tableId}:${factor.source.sourceRow}`);
    lines.push(row([
      clean(factor.source.sourceRow),
      clean(factor.factorName),
      clean(governance?.drawingNumber, "MISSING"),
      clean(governance?.dimId, "MISSING"),
      engineeringText(factor.input.nominalValue, factor.unit),
      engineeringText(factor.mean, factor.unit),
      engineeringText(factor.input.upperTolerance, factor.unit),
      engineeringText(factor.input.lowerTolerance, factor.unit),
      clean(factor.input.distribution, "MISSING"),
      numberText(factor.input.sigmaLevel),
      engineeringText(factor.sigma, factor.unit),
      `F1/F2/F3/F4 ${clean(factor.source.tableId)}`,
    ]));
  }

  const governanceRows = worksheet.f3Worksheet.rows;
  const missingDrawing = governanceRows.filter((item) => !item.drawingNumber).length;
  const missingDim = governanceRows.filter((item) => !item.dimId).length;
  const missingDistribution = calculation.factors.filter((factor) => !factor.input.distribution).length;
  lines.push(
    "",
    "### 输入完整性",
    "",
    `- Factors：${calculation.factorCount}`,
    `- Drawing Number 缺失：${missingDrawing}`,
    `- DIM ID 缺失：${missingDim}`,
    `- Distribution 缺失：${missingDistribution}`,
    `- 阻塞计算的问题：${worksheet.f2Worksheet.missingFieldSummary?.length ? clean(worksheet.f2Worksheet.missingFieldSummary.join("; ")) : "None"}`,
  );
  return lines;
}

function renderResults(worksheet) {
  const calculation = worksheet.f4Calculation;
  const unit = calculation.factors[0]?.unit ?? "unit";
  const projection = createF6ReportProjection({ calculation, inputResolution: 1e-12 });
  const stat = projection.margins.statistical;
  const worstCase = projection.margins.worstCase;
  const selfChecks = [
    projection.selfChecks.mean,
    projection.selfChecks.rss,
    projection.selfChecks.worstCaseUpper,
    projection.selfChecks.worstCaseLower,
    projection.selfChecks.worstCase,
    ...projection.selfChecks.ranges,
  ];
  return [
    "## 3.5 结果与规格符合性",
    "",
    "| Metric | Lower | Upper | Minimum Margin | Result | Source |",
    "|---|---:|---:|---:|---|---|",
    row([`${numberText(stat.sigmaLevel)}σ Statistical Range`, engineeringText(stat.lowerBound, unit), engineeringText(stat.upperBound, unit), engineeringText(stat.minimumMargin, unit), NA, "F6 governed projection"]),
    row(["Worst-Case Range", engineeringText(worstCase.lowerBound, unit), engineeringText(worstCase.upperBound, unit), engineeringText(worstCase.minimumMargin, unit), NA, "F6 governed projection"]),
    "",
    "| Capability Metric | Value | Result | Source |",
    "|---|---:|---|---|",
    row(["Predictive Cp", numberText(calculation.capability.cp), clean(calculation.capability.cpStatus, NA), "F4 capability.cpStatus"]),
    row(["Predictive CpkL", numberText(calculation.capability.lowerCpk), clean(calculation.capability.lowerCpkStatus, NA), "F4 capability.lowerCpkStatus"]),
    row(["Predictive CpkU", numberText(calculation.capability.upperCpk), clean(calculation.capability.upperCpkStatus, NA), "F4 capability.upperCpkStatus"]),
    row(["Predictive Cpk", numberText(calculation.capability.cpk), clean(calculation.capability.status, NA), "F4 capability.status"]),
    row(["Predicted Yield", percentText(calculation.capability.yield), NA, "F4 calculation"]),
    row(["Predicted DPM", numberText(calculation.capability.totalDpm), NA, "F4 calculation"]),
    "",
    `- Mean Response：${engineeringText(calculation.system.mean, unit)}`,
    `- Mean Shift：${engineeringText(calculation.system.additionalMeanShift, unit)}`,
    `- RSS 1σ：${engineeringText(calculation.system.rssSigma, unit)}`,
    `- F6 Projection Formula Checks：${clean(projection.formulaChecks.map(({ outputField, formulaId }) => `${outputField}:${formulaId}`).join("; "))}`,
    `- F6 Projection Consistency Checks：${clean(selfChecks.map(({ checkId, result }) => `${checkId}:${result}`).join("; "))}`,
    "- Yield / Cpk 限制：基于设计公差模型，不等同于实测量产能力。",
    "- Margin 和 self-check 来自 F6 governed projection；不在最终报告中重算第二套工程数学。",
  ];
}

function renderContributors(worksheet) {
  const sortedFactors = [...worksheet.f4Calculation.factors].sort((left, right) => right.contribution - left.contribution);
  let cumulative = 0;
  const lines = [
    "## 3.6 贡献与敏感度",
    "",
    "| Rank | Factor | 1σ | Variance Contribution | Cumulative | Evidence |",
    "|---:|---|---:|---:|---:|---|",
  ];
  for (const [index, factor] of sortedFactors.entries()) {
    cumulative += Math.abs(factor.contribution) <= 1 ? factor.contribution * 100 : factor.contribution;
    lines.push(row([
      `#${index + 1}`,
      clean(factor.factorName),
      engineeringText(factor.sigma, factor.unit),
      percentText(factor.contribution),
      `${numberText(cumulative)}%`,
      `F4/F5 ${clean(factor.source.tableId)}:${clean(factor.source.sourceRow)}`,
    ]));
  }
  lines.push(
    "",
    "> 贡献率表示模型中的方差占比，不等于已确认的物理根因或供应商责任。方向、敏感度或根因解释只有在 F5 存在受支持证据时才可输出。",
  );
  return lines;
}

function renderOptimize(worksheet) {
  const options = worksheet.f6Worksheet.options.filter((option) => (
    option.status === "completed" && option.optionSource === "BUILT_IN_POLICY" && option.policyContext !== undefined
  ));
  if (options.length === 0) return [];
  const unit = worksheet.f4Calculation.factors[0]?.unit ?? "unit";
  const lines = [
    "## 3.7 Optimize",
    "",
    `- Policy：${clean(options[0].policyContext.policyId)}`,
    "- 仅收紧 baseline Top contributors 的 tolerance band；保持各公差带中心不变。",
    "",
    "| Scenario | CpkL | CpkU | Cpk | RSS 1σ | Worst-Case Range | Capability |",
    "|---|---:|---:|---:|---:|---|---|",
    row([
      "Baseline",
      numberText(options[0].baselineMetrics.lowerCpk),
      numberText(options[0].baselineMetrics.upperCpk),
      numberText(options[0].baselineMetrics.cpk),
      engineeringText(options[0].baselineMetrics.rssSigma, unit),
      `${engineeringText(options[0].baselineMetrics.worstCaseLower, unit)} ～ ${engineeringText(options[0].baselineMetrics.worstCaseUpper, unit)}`,
      clean(options[0].baselineMetrics.capabilityStatus, NA),
    ]),
  ];
  for (const option of options) {
    lines.push(row([
      clean(option.policyContext.optionCode),
      numberText(option.resultMetrics.lowerCpk),
      numberText(option.resultMetrics.upperCpk),
      numberText(option.resultMetrics.cpk),
      engineeringText(option.resultMetrics.rssSigma, unit),
      `${engineeringText(option.resultMetrics.worstCaseLower, unit)} ～ ${engineeringText(option.resultMetrics.worstCaseUpper, unit)}`,
      clean(option.resultMetrics.capabilityStatus, NA),
    ]));
  }
  lines.push("", "- 限制：以上结果来自设计公差模型重算，不等于供应商实测能力。");
  return lines;
}

function renderBlockedWorksheet(worksheet) {
  return [
    `# 3. Worksheet：${clean(worksheet.worksheetName)}`,
    "",
    "## 3.1 执行摘要",
    "",
    "| Item | Result | Evidence |",
    "|---|---|---|",
    row(["Final Disposition", dispositionText(worksheet.disposition), "F2 readiness evidence"]),
    row(["Key Finding", primaryFinding(worksheet), "F2 blocked handoff"]),
    row(["Required Action", clean(requiredAction(worksheet)), "F2 missing inputs"]),
    "",
    "## 3.4 输入数据",
    "",
    "| Worksheet | Status | Evidence |",
    "|---|---|---|",
    row([clean(worksheet.worksheetName), clean(worksheet.f2Worksheet.status), clean(blockedMissingFieldSummaryText(worksheet.f2Worksheet.missingFieldSummary), "输入或计算链被阻断")]),
  ];
}

function renderReadyWorksheet(worksheet) {
  const optimize = renderOptimize(worksheet);
  return [
    `# 3. Worksheet：${clean(worksheet.worksheetName)}`,
    "",
    ...renderExecutiveSummary(worksheet),
    "",
    ...renderRequirements(worksheet),
    "",
    ...renderToleranceImage(worksheet),
    "",
    ...renderInputs(worksheet),
    "",
    ...renderResults(worksheet),
    "",
    ...renderContributors(worksheet),
    ...(optimize.length === 0 ? [] : ["", ...optimize]),
  ];
}

function isSummaryExcludedScope(scope) {
  return scope === "datum_chain" || scope === "stack_start";
}

function isSummaryExcludedText(value) {
  return typeof value === "string" && (value.includes("datum_chain") || value.includes("stack_start"));
}

function imageFacts(f5Worksheet) {
  return f5Worksheet.statements.filter((statement) => (
    statement.type === "FACT"
    && statement.content.provenanceKind === "image_observation"
    && !isSummaryExcludedScope(statement.content.scope)
  ));
}

function imageContextSignals(f5Worksheet) {
  return f5Worksheet.statements.filter((statement) => (
    statement.type === "SIGNAL"
    && statement.content.signalKind === "image_text_context_review"
    && !isSummaryExcludedScope(statement.content.scope)
  ));
}

function linkedFactorNames(f5Worksheet, signal) {
  const rowBySource = new Map((f5Worksheet.contextSnapshot?.rows ?? []).map((snapshotRow) => [
    `${snapshotRow.tableId}:${snapshotRow.sourceRow}`,
    snapshotRow.factorName,
  ]));
  return signal.content.linkedSourceRows.map(({ tableId, sourceRow }) => (
    rowBySource.get(`${tableId}:${sourceRow}`) ?? `${tableId}:${sourceRow}`
  ));
}

function _renderSummaryBoundary(lines, worksheet, prefix) {
  lines.push(
    `### ${prefix}.1 输出边界`,
    "",
    "- 图片可见事实仅来自受控图片观察；图示标签不直接视为已验证的 Drawing Number、DIM ID 或 Factor 映射。",
    "- 表格数值来自经验证的结构化输入与确定性计算，不从图片 OCR、补算或改写。",
    "- 工程推断与待确认项不等于最终工程结论；涉及图片的判断必须由 ME 复核。",
  );
  if (worksheet.f5Worksheet.observationVersion === "f5-image-observation-v2") {
    lines.push("- 模型图像解读可能存在幻觉、标签误配或遗漏，不能替代工程结论。");
  }
}

function _renderSummaryImageFacts(lines, worksheet, prefix) {
  const facts = imageFacts(worksheet.f5Worksheet);
  lines.push("", `### ${prefix}.2 图片可见事实`, "");
  if (worksheet.f5Worksheet.observationVersion !== "f5-image-observation-v2") {
    lines.push("图片证据状态：`not_evaluated`。未形成受控图片观察事实。");
    return;
  }
  if (facts.length === 0) {
    lines.push("当前 V2 证据未形成满足 FACT gate 的图片可见事实；保留为待 ME 复核的 SIGNAL。");
    return;
  }
  for (const fact of facts) {
    const labels = (fact.content.visibleLabels ?? []).join("、");
    lines.push(`- ${clean(fact.content.visibleBasis)}${labels ? ` 可见标签：${clean(labels)}。` : ""}（${clean(fact.content.scope)}；${clean(fact.content.confidence)}；${clean(fact.content.reviewStatus)}）`);
  }
}

function _renderSummaryCalculations(lines, worksheet, prefix) {
  const calculation = worksheet.f4Calculation;
  const unit = calculation.factors[0]?.unit ?? "unit";
  const projection = createF6ReportProjection({ calculation, inputResolution: 1e-12 });
  const stat = projection.margins.statistical;
  const worstCase = projection.margins.worstCase;
  lines.push(
    "",
    `### ${prefix}.3 表格可计算结果`,
    "",
    `- Mean Response：${engineeringText(calculation.system.mean, unit)}`,
    `- RSS 1σ：${engineeringText(calculation.system.rssSigma, unit)}`,
    `- ${numberText(stat.sigmaLevel)}σ 预测范围：${engineeringText(stat.lowerBound, unit)} ～ ${engineeringText(stat.upperBound, unit)}`,
    `- Worst-Case 范围：${engineeringText(worstCase.lowerBound, unit)} ～ ${engineeringText(worstCase.upperBound, unit)}`,
    `- Predictive Cp / Cpk：${numberText(calculation.capability.cp)} / ${numberText(calculation.capability.cpk)}`,
    `- Predicted Yield：${percentText(calculation.capability.yield)}`,
    "- 以上能力与良率来自设计公差模型，不等同于实测量产能力。",
  );
}

function _renderSummaryInference(lines, worksheet, prefix) {
  const sorted = [...worksheet.f4Calculation.factors].sort((left, right) => right.contribution - left.contribution);
  const leaders = sorted.slice(0, 3);
  const cumulative = leaders.reduce((sum, factor) => sum + factor.contribution, 0);
  lines.push("", `### ${prefix}.4 工程推断与主要风险`, "");
  if (leaders.length === 0) {
    lines.push("当前没有可排序的 Factor contribution。" );
    return;
  }
  lines.push(
    `- 主要贡献项：${leaders.map((factor) => `${clean(factor.factorName)} (${percentText(factor.contribution)})`).join("、")}。`,
    `- 前 ${leaders.length} 项累计贡献约 ${percentText(cumulative)}；改善优先级应先围绕这些项目验证。`,
    "- 贡献率表示模型方差占比，不等于已确认的物理根因、供应商责任或可制造性结论。",
  );
}

function _renderSummaryAnomalies(lines, worksheet, prefix) {
  const conflicts = imageContextSignals(worksheet.f5Worksheet)
    .filter((signal) => signal.content.signalValue === "indicated_conflict");
  lines.push("", `### ${prefix}.5 图片与 Table 一致性异常`, "");
  if (conflicts.length === 0) {
    lines.push("未发现由当前受控图文证据直接证明的冲突；这不代表图片方向或标签映射已经工程确认。" );
    return;
  }
  lines.push(`发现 ${conflicts.length} 项直接可比异常：`);
  for (const signal of conflicts) {
    const factors = linkedFactorNames(worksheet.f5Worksheet, signal);
    lines.push(`- ${clean(signal.content.textBasis)} 关联 Factor：${clean(factors.join("；"), NA)}。证据状态：${clean(signal.content.signalValue)}；需要 ME 复核。`);
  }
}

function _renderSummaryClarifications(lines, worksheet, prefix) {
  const signals = imageContextSignals(worksheet.f5Worksheet)
    .filter((signal) => signal.content.signalValue !== "indicated_conflict")
    .map((signal) => `${signal.content.textBasis}（${signal.content.signalValue}）`);
  const clarifications = worksheet.f5Worksheet.clarifications
    .filter((item) => !isSummaryExcludedScope(item.structuralScope))
    .map((item) => item.questionForReviewer ?? item.text)
    .filter((text) => typeof text === "string" && text.trim() !== "" && !isSummaryExcludedText(text));
  const questions = [...new Set([...signals, ...clarifications])];
  lines.push("", `### ${prefix}.6 必须澄清的问题`, "");
  if (questions.length === 0) {
    lines.push("当前没有新增澄清项。" );
    return;
  }
  for (const question of questions) lines.push(`- ${clean(question)}`);
}

function _renderSummaryJudgment(lines, worksheet, prefix) {
  const calculation = worksheet.f4Calculation;
  const top = topFactor(calculation);
  const capability = Number.isFinite(calculation.capability.cpk) && Number.isFinite(calculation.capability.targetCpk)
    ? `Predictive Cpk ${numberText(calculation.capability.cpk)} ${calculation.capability.cpk >= calculation.capability.targetCpk ? "达到" : "未达到"} Target Cpk ${numberText(calculation.capability.targetCpk)}`
    : "缺少完整规格或能力结果，不能判定 PASS/FAIL";
  const hasConflict = imageContextSignals(worksheet.f5Worksheet)
    .some((signal) => signal.content.signalValue === "indicated_conflict");
  lines.push(
    "",
    `### ${prefix}.7 初步工程判断`,
    "",
    `${capability}。当前首要变差贡献项为 ${top === undefined ? NA : `${clean(top.factorName)} (${percentText(top.contribution)})`}。${hasConflict ? "图片与 Table 存在待 ME 处理的直接冲突，在确认前不能将图片作为方向正确性的受控证据。" : "图片方向与标签映射仍须按待确认项完成 ME 复核。"}`,
  );
}

function modelInterpretationByWorksheet(context) {
  if (context.modelInterpretation?.contractVersion === "f5-multimodal-artifact-v3") {
    return new Map(context.modelInterpretation.worksheets.map(({ request, result }) => [
      result.worksheetName,
      { ...result, request },
    ]));
  }
  if (context.modelInterpretation?.contractVersion === "f5-multimodal-artifact-v4") {
    return new Map(context.modelInterpretation.worksheets
      .filter((worksheet) => worksheet.status === "completed")
      .map(({ request, result }) => [
        result.worksheetName,
        { ...result, request },
      ]));
  }
  if (context.f6Optimization.provenance.modelInterpretationDecision?.outcome !== "CALLER_AUTHORIZED"
    || context.modelInterpretation === undefined) {
    return new Map();
  }
  return new Map(context.modelInterpretation.worksheets.map((worksheet) => [worksheet.worksheetName, worksheet]));
}

function usesModelInterpretationV2(context) {
  return context.modelInterpretation?.interpretationVersion === "f6-model-interpretation-v2";
}

function usesRequiredMultimodalArtifact(context) {
  return context.modelInterpretation?.contractVersion === "f5-multimodal-artifact-v3"
    || context.modelInterpretation?.contractVersion === "f5-multimodal-artifact-v4";
}

function renderMultimodalInterpretation(lines, interpretation, prefix) {
  lines.push(
    `### ${prefix}.1 图片 + Factor Table 模型解读`,
    "",
    clean(interpretation.imageTableInterpretation),
    "",
    "| Factor | Source Row | 图片与表格上下文解读 |",
    "|---|---:|---|",
  );
  for (const mapping of interpretation.rowMappings) {
    lines.push(row([
      mapping.factorOrdinal.value,
      mapping.sourceRow,
      mapping.interpretation,
    ]));
  }
}

function classFromOption(option) {
  if (option.optionSource === "BUILT_IN_POLICY") return "factor_tolerance";
  if (option.targetContext?.targetType === "factor_nominal") return "factor_nominal";
  if (option.targetContext?.targetType === "system_mean_shift") return "system_mean_shift";
  if (option.targetContext?.targetType === "system_specification") return "system_specification";
  return "factor_tolerance";
}

function classClarifications(worksheet, adjustmentClass) {
  return worksheet.f6Worksheet.clarifications.filter((item) => {
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

function optionEvidenceText(option) {
  if (option.status === "completed") {
    const baseline = option.baselineMetrics;
    const result = option.resultMetrics;
    return `${option.optionId}: Cpk ${numberText(result.cpk)} (Δ${numberText(result.cpk - baseline.cpk)}); RSS ${numberText(result.rssSigma)} (Δ${numberText(result.rssSigma - baseline.rssSigma)})`;
  }
  if (option.status === "insufficient_evidence") {
    return `${option.optionId}: insufficient_evidence (${option.requiredInputs.join(", ")})`;
  }
  if (option.status === "calculation_failed") {
    return `${option.optionId}: calculation_failed (${option.reasonCode})`;
  }
  return `${option.optionId}: ${option.status}`;
}

function governanceNote(adjustmentClass) {
  if (adjustmentClass === "system_specification") {
    return "Requirement Change; caller authorization and ME review required; no automatic change.";
  }
  return "Deterministic option values come from F4-backed scenario evidence only.";
}

function renderStructuredRecommendationBasis(lines, worksheet, interpretation, prefix) {
  lines.push(
    `### ${prefix}.1 模型建议依据`,
    "",
    "| Adjustment Class | Model Disposition | Priority | Rationale | Deterministic Option Evidence | Clarifications | Governance Note |",
    "|---|---|---:|---|---|---|---|",
  );

  const assessmentByClass = new Map(interpretation.optimizationAssessment.map((assessment) => [assessment.adjustmentClass, assessment]));
  for (const adjustmentClass of RECOMMENDATION_CLASS_ORDER) {
    const assessment = assessmentByClass.get(adjustmentClass);
    if (assessment === undefined) continue;
    const options = worksheet.f6Worksheet.options.filter((option) => classFromOption(option) === adjustmentClass);
    const optionText = options.length === 0
      ? "No deterministic scenario executed."
      : options.map((option) => optionEvidenceText(option)).join("; ");
    const clarifications = classClarifications(worksheet, adjustmentClass);
    const clarificationText = clarifications.length === 0
      ? "None"
      : clarifications.map((item) => clarificationReasonCode(item, adjustmentClass)).join("; ");
    lines.push(row([
      clean(adjustmentClass),
      clean(assessment.disposition),
      clean(assessment.priority),
      clean(assessment.rationale),
      clean(optionText),
      clean(clarificationText),
      clean(governanceNote(adjustmentClass)),
    ]));
  }
}

function renderAnalysisSummary(context) {
  const lines = ["# 4. TA 总结性分析"];
  const interpretations = modelInterpretationByWorksheet(context);
  const useV2 = usesModelInterpretationV2(context);
  const useMultimodalArtifact = usesRequiredMultimodalArtifact(context);
  context.worksheets.forEach((worksheet, index) => {
    const section = `4.${index + 1}`;
    lines.push("", `## ${section} Worksheet：${clean(worksheet.worksheetName)}`, "");
    const interpretation = interpretations.get(worksheet.worksheetName);
    if (worksheet.f2Worksheet.status !== "ready"
      || worksheet.f4Calculation === undefined
      || interpretation === undefined
      || interpretation.tableId !== worksheet.f4Calculation.worksheetSelection.tableId) {
      lines.push("模型解读 unavailable");
      return;
    }

    if (useV2) {
      renderStructuredRecommendationBasis(lines, worksheet, interpretation, section);
      return;
    }

    if (useMultimodalArtifact) {
      renderMultimodalInterpretation(lines, interpretation, section);
      return;
    }

    const declaredLinks = Object.values(interpretation.sourceReferences).map(({ artifact }) => artifact);
    const validated = validateModelMarkdown(interpretation.narrativeMarkdown, declaredLinks);
    lines.push(renderCalculationClaims(validated, interpretation.calculationClaims));
  });
  return lines;
}

function renderMarkdown(context) {
  const lines = [
    ...renderDocumentControl(context),
    "",
    ...renderWorkbookOverview(context),
    "",
    "---",
  ];

  for (const worksheet of context.worksheets) {
    lines.push(
      "",
      ...(worksheet.f2Worksheet.status === "ready" && worksheet.f4Calculation !== undefined
        ? renderReadyWorksheet(worksheet)
        : renderBlockedWorksheet(worksheet)),
    );
  }

  lines.push("", ...renderAnalysisSummary(context));
  return `${lines.join("\n").trimEnd()}\n`;
}

function worksheetRecommendationBasis(worksheet, interpretation, modelInterpretationVersion) {
  if (interpretation === undefined || modelInterpretationVersion !== "f6-model-interpretation-v2") return undefined;
  const assessmentByClass = new Map(interpretation.optimizationAssessment.map((assessment) => [assessment.adjustmentClass, assessment]));
  return RECOMMENDATION_CLASS_ORDER
    .map((adjustmentClass) => {
      const assessment = assessmentByClass.get(adjustmentClass);
      if (assessment === undefined) return undefined;
      return {
        adjustmentClass,
        disposition: assessment.disposition,
        priority: assessment.priority,
        rationale: assessment.rationale,
        optionIds: worksheet.f6Worksheet.options.filter((option) => classFromOption(option) === adjustmentClass).map((option) => option.optionId),
        clarifications: classClarifications(worksheet, adjustmentClass).map((item) => clarificationReasonCode(item, adjustmentClass)),
        governanceNote: governanceNote(adjustmentClass),
      };
    })
    .filter((item) => item !== undefined);
}

function worksheetProjection(worksheet, interpretation, modelInterpretationVersion) {
  const findings = [primaryFinding(worksheet)];
  const assumptions = [];
  const clarifications = [];
  const gatingEvidenceReferences = [];

  if (worksheet.f2Worksheet.status !== "ready") {
    if (Array.isArray(worksheet.f2Worksheet.missingFieldSummary) && worksheet.f2Worksheet.missingFieldSummary.length > 0) {
      clarifications.push(...worksheet.f2Worksheet.missingFieldSummary.map((item) => String(item)));
    }
    gatingEvidenceReferences.push(`F2:${worksheet.worksheetName}`);
  } else {
    const openAssumptions = worksheet.f5Worksheet.assumptions
      .filter((assumption) => assumption.status !== "confirmed")
      .map((assumption) => assumption.text);
    assumptions.push(...openAssumptions);
    clarifications.push(...worksheet.f5Worksheet.clarifications.map((item) => item.text));
    if (worksheet.f5Worksheet.statements.some((statement) => statement.type === "SIGNAL")) {
      gatingEvidenceReferences.push(`F5:${worksheet.worksheetName}:SIGNAL`);
    }
    if (worksheet.f3Worksheet.rows.some((row) => row.governanceStatus !== "complete")) {
      gatingEvidenceReferences.push(`F3:${worksheet.worksheetName}:governance`);
    }
  }

  const base = {
    worksheetName: worksheet.worksheetName,
    toleranceLoopDescription: clean(worksheet.f2Worksheet.toleranceLoopDescription, NA),
    disposition: worksheet.disposition,
    requiredAction: requiredAction(worksheet),
    findings,
    assumptions,
    clarifications,
    gatingEvidenceReferences,
  };

  if (worksheet.f4Calculation === undefined) {
    return base;
  }

  return {
    ...base,
    metrics: {
      mean: worksheet.f4Calculation.system.mean,
      rssSigma: worksheet.f4Calculation.system.rssSigma,
      worstCaseLower: worksheet.f4Calculation.system.worstCaseLower,
      worstCaseUpper: worksheet.f4Calculation.system.worstCaseUpper,
      cp: worksheet.f4Calculation.capability.cp,
      cpk: worksheet.f4Calculation.capability.cpk,
      yield: worksheet.f4Calculation.capability.yield,
      dpm: worksheet.f4Calculation.capability.totalDpm,
    },
    ...(worksheetRecommendationBasis(worksheet, interpretation, modelInterpretationVersion) === undefined
      ? {}
      : { recommendationBasis: worksheetRecommendationBasis(worksheet, interpretation, modelInterpretationVersion) }),
  };
}

function assertMultimodalAuthority(artifact, { f2Report, f3Report, f4Report, f5Report }) {
  const readyWorksheets = f2Report.worksheets.filter(({ status }) => status === "ready");
  const readyNames = readyWorksheets.map(({ worksheetName }) => worksheetName);
  if (artifact.workbookContentHash !== f2Report.workbook.contentHash
    || !isDeepStrictEqual(artifact.selectedWorksheetNames, readyNames)) {
    throw new Error("multimodal v3 scope must exactly match the governed F2 workbook and ready worksheets");
  }
  const completedWorksheets = artifact.contractVersion === "f5-multimodal-artifact-v4"
    ? artifact.worksheets.filter((worksheet) => worksheet.status === "completed")
    : artifact.worksheets;
  for (const pair of artifact.worksheets) {
    const { request } = pair;
    const f2Worksheet = readyWorksheets.find(({ worksheetName }) => worksheetName === request.worksheetName);
    const f3Worksheet = f3Report.worksheets.find(({ worksheetName }) => worksheetName === request.worksheetName);
    const calculation = f4Report.calculations.find(({ worksheetSelection }) => (
      worksheetSelection.worksheetName === request.worksheetName && worksheetSelection.tableId === request.tableId
    ));
    if (request.contractVersion === "f5-multimodal-request-failure-v4") {
      if (request.workbook.fileName !== f2Report.workbook.fileName
        || f2Worksheet === undefined || f3Worksheet === undefined || calculation === undefined
        || request.activeFactorCount !== f2Worksheet.rows.length
        || request.activeFactorCount !== calculation.factors.length
        || request.factorSetHash !== createF5MultimodalFactorSetHash(f2Worksheet.rows)
        || f2Worksheet.rows.some(({ tableId }) => tableId !== request.tableId)) {
        throw new Error("multimodal request-failure authority does not match governed worksheet evidence");
      }
      continue;
    }
    if (request.workbook.fileName !== f2Report.workbook.fileName
      || f2Worksheet === undefined || f3Worksheet === undefined || calculation === undefined
      || request.factorRows.length !== calculation.factors.length) {
      throw new Error("multimodal v3 authority does not match governed worksheet evidence");
    }
    for (const factorRow of request.factorRows) {
      const f2Row = f2Worksheet.rows.find(({ tableId, sourceRow }) => tableId === factorRow.tableId && sourceRow === factorRow.sourceRow);
      const f3Row = f3Worksheet.rows.find(({ source }) => source.tableId === factorRow.tableId && source.sourceRow === factorRow.sourceRow);
      const factor = calculation.factors.find(({ source }) => source.tableId === factorRow.tableId && source.sourceRow === factorRow.sourceRow);
      if (f2Row === undefined || f3Row === undefined || factor === undefined
        || !isDeepStrictEqual(factorRow.factorOrdinal, f2Row.factorOrdinal)
        || !isDeepStrictEqual(factorRow.factorOrdinal, f3Row.factorOrdinal)
        || factorRow.factorName !== factor.factorName
        || factorRow.partName !== f2Row.actualFields.partName
        || factorRow.partCategory !== f2Row.actualFields.partCategory
        || factorRow.drawingNumber !== f2Row.actualFields.drawingNumber
        || !sameDimId(factorRow.dimId, f2Row.actualFields.dimCharacteristicId)
        || factorRow.nominal !== factor.input.nominalValue
        || factorRow.upperTolerance !== factor.input.upperTolerance
        || factorRow.lowerTolerance !== factor.input.lowerTolerance
        || factorRow.longTermSafetyFactor !== factor.input.longTermSafetyFactor
        || factorRow.sigmaLevel !== factor.input.sigmaLevel
        || factorRow.distribution !== factor.input.distribution
        || !isDeepStrictEqual(factorRow.sourceCells, f2Row.sourceCells)) {
        throw new Error("multimodal v3 Factor authority does not match governed worksheet evidence");
      }
    }
  }
  for (const pair of completedWorksheets) {
    const f5Worksheet = f5Report.worksheets.find(({ worksheetName }) => worksheetName === pair.request.worksheetName);
    if (f5Worksheet === undefined
      || pair.request.image.contentHash !== f5Worksheet.imageReference.contentHash
      || pair.request.image.artifactPath !== f5Worksheet.imageReference.relativePath) {
      throw new Error("multimodal v3 authority does not match governed worksheet evidence");
    }
  }
}

function parseRequiredMultimodalArtifact(value) {
  const parsedV4 = f5MultimodalArtifactV4Schema.safeParse(value);
  if (parsedV4.success) return parsedV4.data;
  return parseOrThrow(f5MultimodalArtifactV3Schema, value, "multimodal v3 modelInterpretation");
}

function multimodalBlockedWorksheetDetailsByName(modelInterpretation) {
  if (modelInterpretation?.contractVersion !== "f5-multimodal-artifact-v4") return new Map();
  return new Map(modelInterpretation.worksheets
    .filter((worksheet) => worksheet.status === "failed")
    .map((worksheet) => [worksheet.request.worksheetName, {
      worksheetName: worksheet.request.worksheetName,
      reasonCode: worksheet.reasonCode,
      summary: worksheet.summary,
    }]));
}

export function createF6FinalReportProjection(input = {}, options = {}) {
  const requiredMultimodalV3 = options.requireMultimodalV3 === true
    ? parseRequiredMultimodalArtifact(input.modelInterpretation)
    : undefined;
  const f2Report = parseOrThrow(f2UserReportSchema, input.f2Report, "f2Report");
  const parsedF3V3 = drawingGovernanceResultV3Schema.safeParse(input.f3Report);
  const f3Report = parsedF3V3.success
    ? parsedF3V3.data
    : parseOrThrow(drawingGovernanceResultV2Schema, input.f3Report, "f3Report");
  const f4Report = parseOrThrow(f4WorkflowCalculationResultSchema, input.f4Report, "f4Report");
  const f5Report = parseOrThrow(f5DataInterpretationResultSchema, input.f5Report, "f5Report");
  const f6Optimization = parseOrThrow(f6ReadableOptimizationResultSchema, input.f6Optimization, "f6Optimization");
  const analysisContext = input.analysisContext === undefined
    ? undefined
    : parseOrThrow(f6AnalysisContextSchema, input.analysisContext, "analysisContext");
  const analysisRequestContext = parseOrThrow(analysisRequestContextSchema, input.analysisRequestContext, "analysisRequestContext");
  const modelInterpretation = requiredMultimodalV3 ?? (input.modelInterpretation === undefined
    ? undefined
    : parseOrThrow(f6ModelInterpretationArtifactSchema, input.modelInterpretation, "modelInterpretation"));
  if (requiredMultimodalV3 !== undefined) {
    assertMultimodalAuthority(requiredMultimodalV3, { f2Report, f3Report, f4Report, f5Report });
    const blockedWorksheetDetailsByName = multimodalBlockedWorksheetDetailsByName(requiredMultimodalV3);
    const imageLinks = verifiedImageLinks(requiredMultimodalV3, options);
    if (f6Optimization.optimizationVersion === "f6-optimization-v4") {
      return createF6V4Report({
        f2Report,
        f3Report,
        f4Report,
        f5Report,
        f6Optimization,
        modelInterpretation: requiredMultimodalV3,
        analysisContext,
        analysisRequestContext,
        blockedWorksheetDetailsByName,
        imageLinks,
        generatedAt: options.generatedAt ?? input.generatedAt,
      });
    }
    return createF6V3Report({
      f2Report,
      f3Report,
      f4Report,
      f5Report,
      f6Optimization,
      modelInterpretation: requiredMultimodalV3,
      analysisContext,
      analysisRequestContext,
      blockedWorksheetDetailsByName,
      imageLinks,
      generatedAt: options.generatedAt ?? input.generatedAt,
    });
  }
  void analysisContext;

  const worksheets = buildWorksheetPolicyInputs({
    f2Report,
    f3Report,
    f4Report,
    f5Report,
    f6Optimization,
    blockedWorksheetDetailsByName: multimodalBlockedWorksheetDetailsByName(modelInterpretation),
  });
  const interpretations = modelInterpretationByWorksheet({ f6Optimization, modelInterpretation });
  const worksheetDispositions = worksheets.map(({ worksheetName, disposition }) => ({ worksheetName, disposition }));
  const workbookDisposition = worstDisposition(worksheetDispositions.map(({ disposition }) => disposition));
  const reportSummary = {
    workbookDisposition,
    worksheetDispositions,
  };
  const projection = {
    schemaVersion: "ta-engineering-report-projection-v1",
    title: "TA Engineering Analysis Report",
    workbookDisposition,
    worksheetDispositions,
    workbook: {
      fileName: f2Report.workbook.fileName,
      ...(f2Report.workbook.revision === undefined ? {} : { revision: f2Report.workbook.revision }),
      contentHash: f2Report.workbook.contentHash,
    },
    worksheets: worksheets.map((worksheet) => worksheetProjection(
      worksheet,
      interpretations.get(worksheet.worksheetName),
      modelInterpretation?.interpretationVersion,
    )),
  };

  return {
    markdown: renderMarkdown({
      f2Report,
      f3Report,
      f4Report,
      f5Report,
      f6Optimization,
      analysisContext,
      analysisRequestContext,
      modelInterpretation,
      generatedAt: options.generatedAt ?? input.generatedAt,
      reportSummary,
      worksheets,
    }),
    reportSummary,
    projection,
  };
}