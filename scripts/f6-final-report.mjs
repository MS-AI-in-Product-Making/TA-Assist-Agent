import { isDeepStrictEqual } from "node:util";
import {
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f6AnalysisContextSchema,
  f6ModelInterpretationArtifactSchema,
  f6OptimizationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import { f5MultimodalArtifactV3Schema } from "../packages/contracts/dist/ta-multimodal-contracts.js";
import { createCalculation } from "../packages/workbook-catalog/dist/calculation.js";
import {
  createCalculationRequestFromF4Handoff,
  createF4Handoff,
} from "../packages/workbook-catalog/dist/f4-handoff.js";
import { createF6ReportProjection, F6_DISPOSITION_RANK, worstDisposition } from "../packages/workbook-catalog/dist/index.js";
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

function assertExactWorksheetSet(worksheetNames, readyNames, label) {
  const worksheetNameSet = new Set(worksheetNames);
  const readyNameSet = new Set(readyNames);

  const isExactMatch = worksheetNames.length === worksheetNameSet.size
    && readyNames.length === readyNameSet.size
    && worksheetNameSet.size === readyNameSet.size
    && [...worksheetNameSet].every((name) => readyNameSet.has(name));

  if (!isExactMatch) {
    throw new Error(`Invalid F6 final report input: ${label}.`);
  }
}

function assertReportScope(f2Report, f6Optimization) {
  const reportScope = f6Optimization.provenance.reportScope;
  const expectedWorksheetNames = f2Report.worksheets
    .filter(({ status }) => status === "ready")
    .map(({ worksheetName }) => worksheetName);
  if (f2Report.worksheets.some(({ status }) => status !== "ready")) failInvalid("blocked worksheet");
  if (reportScope.blockedWorksheetNames === undefined) {
    if (!isDeepStrictEqual(reportScope.worksheetNames, expectedWorksheetNames)) failInvalid("report scope");
    return;
  }
  const expectedBlockedWorksheetNames = f2Report.worksheets
    .filter(({ status }) => status === "blocked")
    .map(({ worksheetName }) => worksheetName);
  if (!isDeepStrictEqual(reportScope.worksheetNames, expectedWorksheetNames)
    || !isDeepStrictEqual(reportScope.blockedWorksheetNames, expectedBlockedWorksheetNames)) {
    failInvalid("report scope");
  }
}

const F6_V3_REPORT_CATALOG = {
  en: {
    title: "TA Engineering Analysis Report", workbook: "Workbook Summary", worksheet: "Worksheet",
    image: "Tolerance Path Image", openImage: "Open tolerance path image", factors: "Complete Factor Table",
    interpretation: "Image and Factor Table Context Interpretation", center: "Center Assessment",
    contributors: "Contributor Priorities", specifications: "Specification Changes", factor: "Factor", part: "Part",
    drawing: "Drawing Number", dimId: "DIM ID", nominal: "Nominal", upperTolerance: "+Tolerance",
    lowerTolerance: "-Tolerance", distribution: "Distribution", sigmaLevel: "Sigma Level", status: "Status",
    rank: "Rank", priority: "Priority", guidance: "Guidance", side: "Side", currentLimit: "Current Limit",
    proposedLimit: "Proposed Limit", targetCpk: "Target Cpk", approval: "Approval",
    approvalRequired: "Engineering approval required", noProposal: "No specification change is proposed.",
    clarification: "Clarification required", high: "High", medium: "Medium", lower: "Lower",
  },
  zh: {
    title: "TA 工程分析报告", workbook: "工作簿摘要", worksheet: "工作表", image: "公差路径图片",
    openImage: "打开公差路径图片", factors: "完整 Factor 表", interpretation: "图片与 Factor 表上下文解读",
    center: "中心评估", contributors: "贡献因子优先级", specifications: "规格变更建议", factor: "Factor",
    part: "零件", drawing: "Drawing Number", dimId: "DIM ID", nominal: "名义值", upperTolerance: "+公差",
    lowerTolerance: "-公差", distribution: "分布", sigmaLevel: "Sigma Level", status: "状态", rank: "排序",
    priority: "优先级", guidance: "建议", side: "规格侧", currentLimit: "当前限值", proposedLimit: "建议限值",
    targetCpk: "目标 Cpk", approval: "审批", approvalRequired: "需要工程审批", noProposal: "无需提出规格变更。",
    clarification: "需要澄清", high: "高", medium: "中", lower: "较低",
  },
};

function v3PriorityLabel(rank, count, catalog) {
  if (rank === 1) return catalog.high;
  if (rank <= Math.max(2, Math.ceil(count / 2))) return catalog.medium;
  return catalog.lower;
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

function renderF6V3Worksheet(worksheet, interpretation, ordinal, catalog) {
  const prefix = `3-${ordinal}`;
  const [center, contributors, specifications] = worksheet.f6Worksheet.steps;
  const relativePath = interpretation?.request?.image?.artifactPath;
  const imageLink = typeof relativePath === "string" && !relativePath.includes("..") && !/^[A-Za-z]:|^[/\\]/.test(relativePath)
    ? `[${catalog.openImage}](<${encodeURI(relativePath.replace(/\\/g, "/"))}>)`
    : NA;
  const factors = v3FactorRows(interpretation);
  const lines = [
    `# ${prefix} ${catalog.worksheet}: ${clean(worksheet.worksheetName)}`, "",
    `## ${prefix}.1 ${catalog.image}`, "", imageLink, "",
    `## ${prefix}.2 ${catalog.factors}`, "",
    `| ${catalog.factor} | ${catalog.part} | ${catalog.drawing} | ${catalog.dimId} | ${catalog.nominal} | ${catalog.upperTolerance} | ${catalog.lowerTolerance} | ${catalog.distribution} | ${catalog.sigmaLevel} |`,
    "|---|---|---|---|---:|---:|---:|---|---:|",
  ];
  for (const factor of factors) {
    lines.push(row([clean(factor.factorName), clean(factor.partName), clean(factor.drawingNumber), clean(factor.dimId),
      numberText(factor.nominal), numberText(factor.upperTolerance), numberText(factor.lowerTolerance),
      clean(factor.distribution), numberText(factor.sigmaLevel)]));
  }
  lines.push("", `## ${prefix}.3 ${catalog.interpretation}`, "", clean(interpretation.imageTableInterpretation));
  for (const factor of factors) lines.push(`- ${clean(factor.factorName)}: ${clean(factor.rowInterpretation)}`);
  lines.push("", `## ${prefix}.4 ${catalog.center}`, "", `- ${catalog.status}: ${clean(center.status)}`);
  if (center.status === "offset") lines.push(`- Offset: ${numberText(center.offset)}. ${clean(center.interpretation)}`);
  if (center.status === "clarification_required") lines.push(`- ${catalog.clarification}: ${clean(center.reasonCode)}`);
  lines.push("", `## ${prefix}.5 ${catalog.contributors}`, "",
    `| ${catalog.rank} | ${catalog.factor} | ${catalog.priority} | ${catalog.guidance} |`, "|---:|---|---|---|");
  for (const item of contributors.priorities) {
    lines.push(row([item.rank, clean(item.factor.factorName), v3PriorityLabel(item.rank, contributors.priorities.length, catalog), clean(item.guidance)]));
  }
  lines.push("", `## ${prefix}.6 ${catalog.specifications}`, "");
  if (specifications.proposals.length === 0) lines.push(catalog.noProposal);
  else {
    lines.push(`| ${catalog.side} | ${catalog.currentLimit} | ${catalog.proposedLimit} | ${catalog.targetCpk} | ${catalog.approval} |`, "|---|---:|---:|---:|---|");
    for (const proposal of specifications.proposals) {
      lines.push(row([proposal.side, numberText(proposal.currentLimit), numberText(proposal.proposedLimit), numberText(proposal.targetCpk), catalog.approvalRequired]));
    }
  }
  for (const item of specifications.clarifications) lines.push(`- ${catalog.clarification}: ${clean(item.reasonCode)} (${clean(item.requiredInputs.join(", "))})`);
  return lines;
}

function createF6V3Report({ f2Report, f3Report, f4Report, f5Report, f6Optimization, modelInterpretation, generatedAt }) {
  if (f6Optimization.runStatus !== "COMPLETED" || f6Optimization.worksheets.some(({ runStatus }) => runStatus !== "COMPLETED")) {
    failInvalid("incomplete F6 optimization");
  }
  const worksheets = buildWorksheetPolicyInputs({ f2Report, f3Report, f4Report, f5Report, f6Optimization });
  const interpretations = modelInterpretationByWorksheet({ f6Optimization, modelInterpretation });
  const catalog = F6_V3_REPORT_CATALOG[f6Optimization.interactionLanguage.uiCatalogLanguage];
  const worksheetDispositions = worksheets.map(({ worksheetName, disposition }) => ({ worksheetName, disposition }));
  const workbookDisposition = worstDisposition(worksheetDispositions.map(({ disposition }) => disposition));
  const reportSummary = { workbookDisposition, worksheetDispositions };
  const markdown = [`# ${catalog.title}`, "", `## 1. ${catalog.workbook}`, "", `- Workbook: ${clean(f2Report.workbook.fileName)}`, `- Worksheets: ${worksheets.length}`, `- Generated At: ${reportTimestamp(generatedAt)}`];
  worksheets.forEach((worksheet, index) => markdown.push("", ...renderF6V3Worksheet(worksheet, interpretations.get(worksheet.worksheetName), index + 1, catalog)));
  const projection = {
    schemaVersion: "ta-engineering-report-projection-v1", title: catalog.title, workbookDisposition, worksheetDispositions,
    workbook: { fileName: f2Report.workbook.fileName, ...(f2Report.workbook.revision === undefined ? {} : { revision: f2Report.workbook.revision }), contentHash: f2Report.workbook.contentHash },
    worksheets: worksheets.map((worksheet) => {
      const interpretation = interpretations.get(worksheet.worksheetName);
      const calculation = worksheet.f4Calculation;
      return {
        worksheetName: worksheet.worksheetName,
        toleranceLoopDescription: clean(worksheet.f2Worksheet.toleranceLoopDescription, NA),
        disposition: worksheet.disposition,
        requiredAction: requiredAction(worksheet),
        findings: [clean(interpretation?.imageTableInterpretation)], assumptions: [],
        clarifications: worksheet.f6Worksheet.steps.flatMap((step) => step.step === "centerAssessment" && step.status === "clarification_required"
          ? [step.reasonCode] : step.step === "specificationChanges" ? step.clarifications.map(({ reasonCode }) => reasonCode) : []),
        gatingEvidenceReferences: [`F4:${worksheet.worksheetName}`, `F5-multimodal:${worksheet.worksheetName}`],
        metrics: { mean: calculation.system.mean, rssSigma: calculation.system.rssSigma,
          worstCaseLower: calculation.system.worstCaseLower, worstCaseUpper: calculation.system.worstCaseUpper,
          ...(calculation.capability.cp === undefined ? {} : { cp: calculation.capability.cp }),
          ...(calculation.capability.cpk === undefined ? {} : { cpk: calculation.capability.cpk }),
          ...(calculation.capability.yield === undefined ? {} : { yield: calculation.capability.yield }),
          ...(calculation.capability.totalDpm === undefined ? {} : { dpm: calculation.capability.totalDpm }) },
      };
    }),
  };
  return { markdown: `${markdown.join("\n")}\n`, reportSummary, projection };
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

function buildWorksheetPolicyInputs({ f2Report, f3Report, f4Report, f5Report, f6Optimization }) {
  assertWorkbookIdentity({ f2Report, f3Report, f4Report, f5Report, f6Optimization });
  assertReportScope(f2Report, f6Optimization);
  const readyNames = f2Report.worksheets
    .filter(({ status }) => status === "ready")
    .map(({ worksheetName }) => worksheetName);

  assertExactWorksheetSet(f3Report.worksheets.map(({ worksheetName }) => worksheetName), readyNames, "f3Report");
  assertExactWorksheetSet(
    f5Report.worksheets.filter(({ status }) => status === "completed").map(({ worksheetName }) => worksheetName),
    readyNames,
    "f5Report",
  );
  assertExactWorksheetSet(f6Optimization.worksheets.map(({ worksheetName }) => worksheetName), readyNames, "f6Optimization");

  const f3ByName = indexByWorksheetName(f3Report.worksheets);
  const f5ByName = indexByWorksheetName(
    f5Report.worksheets.filter((worksheet) => worksheet.status === "completed"),
  );
  const f6ByName = indexByWorksheetName(f6Optimization.worksheets);
  const { byName: f4ByName, counts: f4Counts } = indexCalculationsByWorksheetName(f4Report.calculations);
  const f2ReadyByName = indexByWorksheetName(f2Report.worksheets.filter(({ status }) => status === "ready"));
  const f2HandoffByName = indexByWorksheetName(f2Report.f4Handoffs ?? []);
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

    if (f2Worksheet.status !== "ready") {
      return {
        worksheetName,
        disposition: "FAIL",
        f2Worksheet,
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
    };
  });
}

function clean(value, fallback = NA) {
  if (value === null || value === undefined || value === "") return fallback;
  return safeText(value);
}

function dispositionText(value) {
  return F6_DISPOSITION_RANK[value] === undefined ? "FAIL" : value;
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
  return new Map((f3Worksheet?.rows ?? []).map((item) => [
    `${item.source.tableId}:${item.source.sourceRow}`,
    item,
  ]));
}

function reviewStatus(analysisContext) {
  return clean(analysisContext?.reviewedBy ?? analysisContext?.reviewer ?? analysisContext?.review?.reviewedBy, "PENDING");
}

function primaryFinding(context) {
  if (context.disposition === "PASS") return "数值、输入和工程复核均已通过。";
  if (context.f2Worksheet.status !== "ready") return "缺少必填输入、图片或有效计算，当前 worksheet 无法完成分析。";
  if (context.disposition === "INCOMPLETE") return "计算已完成，但 CpkL、CpkU 或规格范围未达到 worksheet 要求。";
  if (context.disposition === "CONDITIONAL_PASS") return "数值达到要求，但仍需补齐 Drawing Number、DIM ID 或完成图像与工程复核。";
  return INSUFFICIENT_EVIDENCE;
}

function reportTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? NOT_PROVIDED : date.toISOString().slice(0, 19).replace("T", " ");
}

function requiredAction(context) {
  if (context.f2Worksheet.status !== "ready") return "Resolve F2 blocked worksheet evidence before F4/F5/F6 interpretation";
  if (context.disposition === "PASS") return "None";
  if (context.disposition === "CONDITIONAL_PASS") return "Close F3/F5 engineering review items";
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
    row(["Report Generated At", reportTimestamp(context.generatedAt), "Report runtime"]),
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
    row(["Evaluation Level", `${numberText(calculation?.capability?.targetSigmaLevel)}σ`, "F2/F4 capability.targetSigmaLevel"]),
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
    row([clean(worksheet.worksheetName), clean(worksheet.f2Worksheet.status), clean(worksheet.f2Worksheet.missingFieldSummary?.join("; "), "输入或计算链被阻断")]),
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
  if (context.f6Optimization.provenance.modelInterpretationDecision?.outcome !== "CALLER_AUTHORIZED"
    || context.modelInterpretation === undefined) {
    return new Map();
  }
  return new Map(context.modelInterpretation.worksheets.map((worksheet) => [worksheet.worksheetName, worksheet]));
}

function usesModelInterpretationV2(context) {
  return context.modelInterpretation?.interpretationVersion === "f6-model-interpretation-v2";
}

function usesMultimodalV3(context) {
  return context.modelInterpretation?.contractVersion === "f5-multimodal-artifact-v3";
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
  const useMultimodalV3 = usesMultimodalV3(context);
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

    if (useMultimodalV3) {
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

function assertMultimodalV3Authority(artifact, { f2Report, f3Report, f4Report, f5Report }) {
  const readyWorksheets = f2Report.worksheets.filter(({ status }) => status === "ready");
  const readyNames = readyWorksheets.map(({ worksheetName }) => worksheetName);
  if (artifact.workbookContentHash !== f2Report.workbook.contentHash
    || !isDeepStrictEqual(artifact.selectedWorksheetNames, readyNames)) {
    throw new Error("multimodal v3 scope must exactly match the governed F2 workbook and ready worksheets");
  }
  for (const pair of artifact.worksheets) {
    const { request } = pair;
    const f2Worksheet = readyWorksheets.find(({ worksheetName }) => worksheetName === request.worksheetName);
    const f3Worksheet = f3Report.worksheets.find(({ worksheetName }) => worksheetName === request.worksheetName);
    const calculation = f4Report.calculations.find(({ worksheetSelection }) => (
      worksheetSelection.worksheetName === request.worksheetName && worksheetSelection.tableId === request.tableId
    ));
    const f5Worksheet = f5Report.worksheets.find(({ worksheetName }) => worksheetName === request.worksheetName);
    if (request.workbook.fileName !== f2Report.workbook.fileName
      || f2Worksheet === undefined || f3Worksheet === undefined || calculation === undefined || f5Worksheet === undefined
      || request.image.contentHash !== f5Worksheet.imageReference.contentHash
      || request.image.artifactPath !== f5Worksheet.imageReference.relativePath
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
        || factorRow.dimId !== f2Row.actualFields.dimCharacteristicId
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
}

export function createF6FinalReportProjection(input = {}, options = {}) {
  const requiredMultimodalV3 = options.requireMultimodalV3 === true
    ? parseOrThrow(f5MultimodalArtifactV3Schema, input.modelInterpretation, "multimodal v3 modelInterpretation")
    : undefined;
  const f2Report = parseOrThrow(f2UserReportSchema, input.f2Report, "f2Report");
  const f3Report = parseOrThrow(drawingGovernanceResultV2Schema, input.f3Report, "f3Report");
  const f4Report = parseOrThrow(f4WorkflowCalculationResultSchema, input.f4Report, "f4Report");
  const f5Report = parseOrThrow(f5DataInterpretationResultSchema, input.f5Report, "f5Report");
  const f6Optimization = parseOrThrow(f6OptimizationResultSchema, input.f6Optimization, "f6Optimization");
  const analysisContext = input.analysisContext === undefined
    ? undefined
    : parseOrThrow(f6AnalysisContextSchema, input.analysisContext, "analysisContext");
  const modelInterpretation = requiredMultimodalV3 ?? (input.modelInterpretation === undefined
    ? undefined
    : parseOrThrow(f6ModelInterpretationArtifactSchema, input.modelInterpretation, "modelInterpretation"));
  if (requiredMultimodalV3 !== undefined) {
    assertMultimodalV3Authority(requiredMultimodalV3, { f2Report, f3Report, f4Report, f5Report });
    return createF6V3Report({
      f2Report,
      f3Report,
      f4Report,
      f5Report,
      f6Optimization,
      modelInterpretation: requiredMultimodalV3,
      generatedAt: options.generatedAt ?? input.generatedAt,
    });
  }
  void analysisContext;

  const worksheets = buildWorksheetPolicyInputs({ f2Report, f3Report, f4Report, f5Report, f6Optimization });
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
      modelInterpretation,
      generatedAt: options.generatedAt ?? input.generatedAt,
      reportSummary,
      worksheets,
    }),
    reportSummary,
    projection,
  };
}