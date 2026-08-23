/* global structuredClone */

export const F6_DISPOSITION_RANK = Object.freeze({
  PASS: 0,
  CONDITIONAL_PASS: 1,
  INCOMPLETE: 2,
  FAIL: 3,
});

import { isDeepStrictEqual } from "node:util";
import {
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f6AnalysisContextSchema,
  f6OptimizationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import { createCalculation } from "../packages/workbook-catalog/dist/calculation.js";
import {
  createCalculationRequestFromF4Handoff,
  createF4Handoff,
} from "../packages/workbook-catalog/dist/f4-handoff.js";
import { createF6ReportProjection } from "../packages/workbook-catalog/dist/index.js";
import { formatEngineering, formatPercent } from "./engineering-format.mjs";
import { safeText } from "./f6-markdown-sanitizer.mjs";

const NOT_PROVIDED = "NOT_PROVIDED";
const INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE";
const NA = "N/A";

function rankDisposition(disposition) {
  return F6_DISPOSITION_RANK[disposition] ?? F6_DISPOSITION_RANK.FAIL;
}

export function worstDisposition(dispositions) {
  if (!Array.isArray(dispositions) || dispositions.length === 0) return "PASS";
  return dispositions.reduce((worst, value) => (
    rankDisposition(value) > rankDisposition(worst) ? value : worst
  ), "PASS");
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
  const expectedWorksheetNames = f2Report.worksheets.map(({ worksheetName }) => worksheetName);
  const expectedBlockedWorksheetNames = f2Report.worksheets
    .filter(({ status }) => status === "blocked")
    .map(({ worksheetName }) => worksheetName);
  if (!isDeepStrictEqual(reportScope.worksheetNames, expectedWorksheetNames)
    || !isDeepStrictEqual(reportScope.blockedWorksheetNames, expectedBlockedWorksheetNames)) {
    failInvalid("report scope");
  }
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
  for (const [field, expected] of Object.entries(expectedMetrics)) {
    if (expected !== undefined
      && f6Worksheet.baselineMetrics[field] !== undefined
      && !nearlyEqual(expected, f6Worksheet.baselineMetrics[field])) {
      failInvalid("baseline metrics");
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

function controlledVersions({ f2Report, f4Report, f5Report }) {
  return [
    `public=${clean(f2Report.knowledgeBaseVersions?.[0], NA)}`,
    `internal=${clean(f2Report.knowledgeBaseVersions?.[1], NA)}`,
    `F4=${clean(f4Report.calculations[0]?.calculationVersion, NA)}`,
    `F5=${clean(f5Report.knowledgeBaseVersion, NA)}`,
  ].join("; ");
}

function reviewStatus(analysisContext) {
  return clean(analysisContext?.reviewedBy ?? analysisContext?.reviewer ?? analysisContext?.review?.reviewedBy, "PENDING");
}

function f1ImageReference(f3Worksheet) {
  const reference = f3Worksheet?.rows?.[0]?.imageReference;
  if (reference === undefined) return NA;
  return `artifact=${clean(reference.artifact)}; worksheet=${clean(reference.worksheetName)}; path=${clean(reference.relativePath)}; sha256=${clean(reference.contentHash)}`;
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

function renderTraceability(context) {
  const f1References = context.worksheets
    .map((worksheet) => `${worksheet.worksheetName}: ${f1ImageReference(worksheet.f3Worksheet)}`)
    .join("; ");
  const f2References = context.f2Report.worksheets
    .map((worksheet) => `${worksheet.worksheetName}: status=${worksheet.status}`)
    .join("; ");
  const f3References = context.f3Report.worksheets
    .map((worksheet) => `${worksheet.worksheetName}: rows=${worksheet.rows.length}`)
    .join("; ");
  const f4References = context.f4Report.calculations
    .map((calculation) => `${calculation.worksheetSelection.worksheetName}: ${calculation.traceRecords.map((trace) => trace.formulaId).join(", ")}`)
    .join("; ");
  const f5References = context.f5Report.worksheets
    .map((worksheet) => `${worksheet.worksheetName}: statements=${worksheet.statements.length}; clarifications=${worksheet.clarifications.length}`)
    .join("; ");
  return [
    "# 4. Appendix: Reference Traceability",
    "",
    "| Reference | Traceability |",
    "|---|---|",
    row(["F0 controlled versions", controlledVersions(context)]),
    row(["F1 workbook cells / source rows / image identity", clean(f1References, NA)]),
    row(["F2 specification / readiness / missing inputs", clean(f2References, NA)]),
    row(["F3 Drawing Number / DIM ID governance", clean(f3References, NA)]),
    row(["F4 calculation / formula IDs / precision", clean(f4References, NA)]),
    row(["F5 FACT / RULE / SIGNAL / OPTION / clarification IDs", clean(f5References, NA)]),
    row(["F6 optimization artifact provenance", clean(context.f6Optimization.artifactReference, NA)]),
  ];
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

  lines.push("", ...renderTraceability(context));
  return `${lines.join("\n").trimEnd()}\n`;
}

export function createF6FinalReportProjection(input = {}, options = {}) {
  const f2Report = parseOrThrow(f2UserReportSchema, input.f2Report, "f2Report");
  const f3Report = parseOrThrow(drawingGovernanceResultV2Schema, input.f3Report, "f3Report");
  const f4Report = parseOrThrow(f4WorkflowCalculationResultSchema, input.f4Report, "f4Report");
  const f5Report = parseOrThrow(f5DataInterpretationResultSchema, input.f5Report, "f5Report");
  const f6Optimization = parseOrThrow(f6OptimizationResultSchema, input.f6Optimization, "f6Optimization");
  const analysisContext = input.analysisContext === undefined
    ? undefined
    : parseOrThrow(f6AnalysisContextSchema, input.analysisContext, "analysisContext");
  void analysisContext;

  const worksheets = buildWorksheetPolicyInputs({ f2Report, f3Report, f4Report, f5Report, f6Optimization });
  const worksheetDispositions = worksheets.map(({ worksheetName, disposition }) => ({ worksheetName, disposition }));
  const workbookDisposition = worstDisposition(worksheetDispositions.map(({ disposition }) => disposition));
  const reportSummary = {
    workbookDisposition,
    worksheetDispositions,
  };

  return {
    markdown: renderMarkdown({
      f2Report,
      f3Report,
      f4Report,
      f5Report,
      f6Optimization,
      analysisContext,
      generatedAt: options.generatedAt ?? input.generatedAt,
      reportSummary,
      worksheets,
    }),
    reportSummary,
  };
}