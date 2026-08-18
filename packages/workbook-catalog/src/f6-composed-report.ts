import {
  f2UserReportSchema,
  f5DataInterpretationResultSchema,
  f6AnalysisContextSchema,
  f6ComposedEngineeringReportSchema,
  f6LegacyComposedEngineeringReportSchema as legacyComposedSchema,
  f6LegacyOptimizationResultSchema,
  f6OptimizationResultSchema,
  type F2UserReport,
  type F5DataInterpretationResult,
  type F6AnalysisContext,
  type F6ComposedEngineeringReport,
  type F6ComposedEngineeringReportV2,
  type F6OptimizationResult,
  type F6OptimizationResultV2,
  type F6Option,
} from "@ai-assist/contracts";
import { createF6ReportProjection } from "./f6-report-projection.js";

interface F6ComposedEngineeringReportInput {
  readonly f2Report: F2UserReport;
  readonly f5Report: F5DataInterpretationResult;
  readonly f6Result: F6OptimizationResult;
}

type ArtifactReference = { readonly artifact: string; readonly contentHash: string };
type ReadyF6Worksheet = Exclude<F6OptimizationResult["worksheets"][number], { status: "input_rejected" }>;
type CompletedF5Worksheet = Extract<F5DataInterpretationResult["worksheets"][number], { status: "completed" }>;
type WhatIfRow = F6ComposedEngineeringReport["worksheets"][number]["sections"]["whatIfAnalysis"]["options"][number];
type RiskRow = F6ComposedEngineeringReport["worksheets"][number]["sections"]["riskAssessment"][number];

const STATUS_RANK = { PASS: 0, RISK: 1, FAIL: 2 } as const;
const RISK_RANK = { Low: 0, Medium: 1, High: 2, Critical: 3 } as const;
const CONTRIBUTOR_POLICY = { top1Percent: 50, top3Percent: 80 } as const;
const FIXED_RISK_CATEGORIES = ["Product", "Manufacturing", "Assembly", "Supplier", "Customer Experience"] as const;

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function immutable<Value>(value: Value): Value {
  return deepFreeze(structuredClone(value));
}

function uniqueReferences(references: readonly ArtifactReference[]): ArtifactReference[] {
  return [...new Map(references.map((reference) => [
    `${reference.artifact}\u0000${reference.contentHash}`,
    structuredClone(reference),
  ])).values()];
}

function sameNames(left: readonly string[], right: readonly string[]): boolean {
  const leftNames = new Set(left);
  const rightNames = new Set(right);
  return leftNames.size === left.length
    && rightNames.size === right.length
    && leftNames.size === rightNames.size
    && left.every((name) => rightNames.has(name));
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function assertBaselineIdentity(
  f5Worksheet: CompletedF5Worksheet,
  f6Worksheet: ReadyF6Worksheet,
  provenance: F6OptimizationResult["provenance"],
): void {
  const calculation = f5Worksheet.calculationResult;
  const expectedRunReference = `${provenance.f4Reference.runId}-${f6Worksheet.f4CalculationIndex}`;
  if (calculation.runReference !== expectedRunReference
    || calculation.calculationVersion !== provenance.f4Reference.calculationVersion
    || calculation.worksheetSelection.worksheetName !== f6Worksheet.worksheetName) {
    throw new Error("F5 and F6 worksheet calculation identity mismatch.");
  }
  const baselineIdentity = f6Worksheet.baselineIdentity;
  const factorIdentities = calculation.factors.map((factor) => {
    const identity: Partial<typeof factor> = structuredClone(factor);
    delete identity.trace;
    return identity;
  });
  if (calculation.projectReference !== baselineIdentity.projectReference
    || calculation.runReference !== baselineIdentity.runReference
    || calculation.calculationVersion !== baselineIdentity.calculationVersion
    || calculation.workbookContentHash !== baselineIdentity.workbookContentHash
    || calculation.worksheetSelection.worksheetName !== baselineIdentity.worksheetName
    || calculation.worksheetSelection.tableId !== baselineIdentity.tableId
    || calculation.factorCount !== baselineIdentity.factorCount
    || JSON.stringify(factorIdentities) !== JSON.stringify(baselineIdentity.factors)
    || JSON.stringify(calculation.system) !== JSON.stringify(baselineIdentity.system)
    || JSON.stringify(calculation.capability) !== JSON.stringify(baselineIdentity.capability)) {
    throw new Error("F5 and F6 worksheet calculation identity mismatch.");
  }
  const expected = {
    mean: calculation.system.mean,
    rssSigma: calculation.system.rssSigma,
    cp: calculation.capability.cp,
    cpk: calculation.capability.cpk,
    yield: calculation.capability.yield,
    dpm: calculation.capability.totalDpm,
  };
  for (const field of Object.keys(expected) as Array<keyof typeof expected>) {
    if (!nearlyEqual(expected[field], f6Worksheet.baselineMetrics[field])) {
      throw new Error("F5 and F6 worksheet baseline identity mismatch.");
    }
  }
}

function requirementViolation(findings: ReadyF6Worksheet["inputFindings"]): boolean {
  return findings.some(({ findingKind }) => findingKind === "confirmed_requirement_violation");
}

function worksheetStatus(
  worksheet: ReadyF6Worksheet,
  confirmedRequirementViolation: boolean,
  missingCapabilityData: boolean,
): "PASS" | "FAIL" | "RISK" {
  if (confirmedRequirementViolation) return "FAIL";
  if (missingCapabilityData) return "RISK";
  if (worksheet.baselineMetrics.cpk < 1) return "FAIL";
  if (worksheet.status !== "completed"
    || worksheet.inputFindings.some(({ findingKind }) => findingKind === "optimization_failure")) return "RISK";
  const assessedCategories = new Set(worksheet.risks.map(({ category }) => category));
  if (FIXED_RISK_CATEGORIES.some((category) => !assessedCategories.has(category))) return "RISK";
  const hasOpenHighRisk = worksheet.risks.some(({ status, rating }) =>
    status === "open" && (rating === "High" || rating === "Critical"));
  if (worksheet.baselineMetrics.cpk < worksheet.targetCapability.targetCpk
    || hasOpenHighRisk) return "RISK";
  return "PASS";
}

function statementSummary(statement: CompletedF5Worksheet["statements"][number]): string {
  if (statement.type === "FACT") {
    if (statement.content.provenanceKind === "image_observation") {
      return `FACT ${statement.statementId}: visual ${statement.content.scope} observation remains ${statement.content.reviewStatus}.`;
    }
    if (statement.content.provenanceKind === "f3_governance") {
      return `FACT ${statement.statementId}: governed drawing and DIM identity evidence.`;
    }
    if ("metric" in statement.content) return `FACT ${statement.statementId}: governed ${statement.content.metric} evidence.`;
    return `FACT ${statement.statementId}: governed calculation evidence.`;
  }
  if (statement.type === "SIGNAL") {
    const signalKind = "signalKind" in statement.content ? statement.content.signalKind : "engineering_review";
    return `SIGNAL ${statement.statementId}: ${signalKind}; engineering review required.`;
  }
  if (statement.type === "RULE") return `RULE ${statement.statementId}: governed interpretation rule evidence.`;
  return `OPTION ${statement.statementId}: F5 option evidence retained without recommendation promotion.`;
}

function optionSummary(option: F6Option, fallbackReference: ArtifactReference): WhatIfRow {
  const evidenceReferences = uniqueReferences(option.evidenceReferences.length > 0
    ? option.evidenceReferences
    : [fallbackReference]);
  if (option.status === "completed") {
    if (option.optionKind === "improve_supplier_capability" || option.optionKind === "tighten_datum_strategy") {
      if (option.evidenceScope === undefined) throw new Error("Governed Supplier/Datum option evidence is missing.");
      return {
        optionKind: option.optionKind,
        status: "completed",
        summary: `${option.optionKind}: delta Cpk ${option.deltaCpk}.`,
        predictedImprovement: option.deltaCpk,
        governedEvidenceReference: option.evidenceScope.evidenceReference.artifact,
        evidenceStatus: "confirmed",
        evidenceReferences,
      };
    }
    if (option.optionKind !== "reduce_top_contributor_20" && option.optionKind !== "reduce_top_3_contributors_30") {
      throw new Error("Unexpected completed option in fixed What-If analysis.");
    }
    return {
      optionKind: option.optionKind,
      status: "completed",
      summary: `${option.optionKind}: delta Cpk ${option.deltaCpk}.`,
      predictedImprovement: option.deltaCpk,
      evidenceReferences,
    };
  }
  if (option.status === "insufficient_evidence") {
    return {
      optionKind: option.optionKind,
      status: "insufficient_evidence" as const,
      summary: `${option.optionKind}: insufficient_evidence; required inputs: ${option.requiredInputs.join(", ")}.`,
      predictedImprovement: "insufficient_evidence" as const,
      requiredInputs: structuredClone(option.requiredInputs),
      evidenceReferences,
    };
  }
  return {
    optionKind: option.optionKind,
    status: "calculation_failed" as const,
    summary: `${option.optionKind}: calculation_failed.`,
    reasonCode: option.reasonCode,
    evidenceReferences,
  };
}

function buildWhatIfOptions(worksheet: ReadyF6Worksheet, fallbackReference: ArtifactReference) {
  const kinds = [
    "reduce_top_contributor_20",
    "reduce_top_3_contributors_30",
    "improve_supplier_capability",
    "tighten_datum_strategy",
  ] as const;
  return kinds.map((kind) => {
    const option = worksheet.options.find(({ optionKind }) => optionKind === kind);
    if (option === undefined) throw new Error("Fixed What-If option is missing.");
    return optionSummary(option, fallbackReference);
  });
}

function buildRisks(worksheet: ReadyF6Worksheet, fallbackReference: ArtifactReference): RiskRow[] {
  const rows: RiskRow[] = [];
  for (const category of FIXED_RISK_CATEGORIES) {
    const matching = worksheet.risks.filter((risk) => risk.category === category);
    if (matching.length === 0) {
      rows.push({
        category,
        rating: "insufficient_evidence",
        status: "insufficient_evidence",
        reason: "Missing evidence-backed risk assessment for this area.",
        evidenceReferences: [structuredClone(fallbackReference)],
      });
      continue;
    }
    for (const risk of matching) {
      rows.push({
        category,
        rating: risk.rating,
        status: risk.status,
        reason: risk.reason,
        evidenceReferences: uniqueReferences(risk.evidenceReferences),
      });
    }
  }
  return rows;
}

function buildWorksheet(
  f5Worksheet: CompletedF5Worksheet,
  f6Worksheet: ReadyF6Worksheet,
  provenance: F6OptimizationResult["provenance"],
): F6ComposedEngineeringReport["worksheets"][number] {
  assertBaselineIdentity(f5Worksheet, f6Worksheet, provenance);
  const calculation = f5Worksheet.calculationResult;
  const f5Reference = { artifact: provenance.f5Reference.artifact, contentHash: provenance.f5Reference.contentHash };
  const f4Reference = { artifact: provenance.f4Reference.artifact, contentHash: provenance.f4Reference.contentHash };
  const f2Reference = provenance.f2Reference;
  const evidenceReferences = uniqueReferences([f2Reference, f4Reference, f5Reference]);
  const confirmedRequirementViolation = requirementViolation(f6Worksheet.inputFindings);
  const missingCapabilityData = false as const;
  const status = worksheetStatus(f6Worksheet, confirmedRequirementViolation, missingCapabilityData);
  const contributors = f5Worksheet.sections.majorContributors.items.slice(0, 5);
  const top1Concentration = contributors[0]?.contributionPercent ?? 0;
  const top3Concentration = contributors.slice(0, 3).reduce((total, contributor) => total + contributor.contributionPercent, 0);
  const topContributor = contributors[0];
  const highestRisk = f6Worksheet.risks
    .filter(({ status: riskStatus }) => riskStatus === "open")
    .sort((left, right) => RISK_RANK[right.rating] - RISK_RANK[left.rating])[0];
  const highestImpactAction = f6Worksheet.highestImpactAction === undefined
    ? "Highest Impact Action: insufficient_evidence until a supported verified option is available."
    : `Highest Impact Action: ${f6Worksheet.highestImpactAction.optionId}.`;
  const optionById = new Map(f6Worksheet.options.map((option) => [option.optionId, option]));
  const recommendations = [
    ...f6Worksheet.recommendations
      .map((recommendation) => {
        const option = recommendation.optionId === undefined ? undefined : optionById.get(recommendation.optionId);
        if (option?.status !== "completed" || option.feasibility.status !== "supported") {
          throw new Error("Recommendation option evidence is invalid.");
        }
        return {
          impactRank: option.impactRank ?? Number.MAX_SAFE_INTEGER,
          recommendation: {
            kind: "verified_option" as const,
            recommendationId: recommendation.recommendationId,
            optionId: option.optionId,
            text: recommendation.text,
            expectedBenefit: `Verified delta Cpk ${option.deltaCpk}.`,
            evidenceReferences: uniqueReferences(recommendation.evidenceReferences),
          },
        };
      })
      .sort((left, right) => left.impactRank - right.impactRank
        || left.recommendation.recommendationId.localeCompare(right.recommendation.recommendationId))
      .map(({ recommendation }) => recommendation),
    ...[...f6Worksheet.clarifications]
      .sort((left, right) => left.clarificationId.localeCompare(right.clarificationId))
      .map((clarification) => ({
        kind: "evidence_closure" as const,
        recommendationId: `evidence-closure:${clarification.clarificationId}`,
        clarificationId: clarification.clarificationId,
        text: `Evidence closure ${clarification.clarificationId}: ${clarification.questionForReviewer} Required inputs: ${clarification.requiredInputs.join(", ")}.`,
        expectedBenefit: `Close evidence gap for ${clarification.requiredInputs.join(", ")}.`,
        evidenceReferences: uniqueReferences(clarification.evidenceReferences.length > 0
          ? clarification.evidenceReferences
          : [f5Reference]),
      })),
  ];
  const factBasedFindings = f5Worksheet.statements
    .filter(({ type }) => type === "FACT")
    .map(statementSummary);
  const ruleFindings = f5Worksheet.statements
    .filter(({ type }) => type === "RULE")
    .map(statementSummary);
  const optionFindings = f5Worksheet.statements
    .filter(({ type }) => type === "OPTION")
    .map(statementSummary);
  const signals = f5Worksheet.statements
    .filter(({ type }) => type === "SIGNAL")
    .map(statementSummary);
  const capabilityFindings = [
    `Baseline Cpk ${f6Worksheet.baselineMetrics.cpk} versus target ${f6Worksheet.targetCapability.targetCpk}.`,
    `Yield ${f6Worksheet.baselineMetrics.yield}; OOS rate ${1 - f6Worksheet.baselineMetrics.yield}.`,
    `Capability status ${status}.`,
  ];
  const targetSource = f6Worksheet.targetCapability.source === "worksheet" ? "worksheet" : "controlled default";

  return {
    worksheetName: f6Worksheet.worksheetName,
    status,
    targetCapability: structuredClone(f6Worksheet.targetCapability),
    confirmedRequirementViolation,
    missingCapabilityData,
    evidenceReferences,
    sections: {
      executiveSummary: [
        `Status: ${status}.`,
        `Cpk ${f6Worksheet.baselineMetrics.cpk} versus target ${f6Worksheet.targetCapability.targetCpk}.`,
        `Yield ${f6Worksheet.baselineMetrics.yield}; OOS ${1 - f6Worksheet.baselineMetrics.yield}.`,
        topContributor === undefined ? "Top contributor: insufficient_evidence." : `Top contributor: ${topContributor.factorName} (${topContributor.contributionPercent}%).`,
        highestRisk === undefined ? highestImpactAction : `Key risk: ${highestRisk.rating} ${highestRisk.category}; ${highestImpactAction}`,
      ],
      requirementReview: {
        ctq: f5Worksheet.governanceRows[0]?.dimensionDescription ?? f6Worksheet.worksheetName,
        nominal: calculation.system.designNominal,
        lowerSpecLimit: calculation.capability.lowerSpecLimit,
        upperSpecLimit: calculation.capability.upperSpecLimit,
        specWidth: calculation.capability.upperSpecLimit - calculation.capability.lowerSpecLimit,
        assessment: confirmedRequirementViolation ? "Confirmed requirement violation." : "Requirement identity and governed specification are available.",
        riskLevel: status === "FAIL" ? "Critical" : status === "RISK" ? "High" : "Low",
        evidenceReferences: [structuredClone(f4Reference)],
      },
      inputValidation: f6Worksheet.inputFindings.map((finding) => ({
        ...structuredClone(finding),
        evidenceReferences: uniqueReferences(finding.evidenceReferences.length > 0
          ? finding.evidenceReferences
          : [f2Reference]),
      })),
      capabilityAssessment: {
        metrics: structuredClone(f6Worksheet.baselineMetrics),
        oosRate: 1 - f6Worksheet.baselineMetrics.yield,
        oosPpm: f6Worksheet.baselineMetrics.dpm,
        findings: capabilityFindings,
        evidenceReferences: [structuredClone(f4Reference), structuredClone(f5Reference)],
      },
      contributorAnalysis: {
        topContributors: contributors.map(({ factorName, contributionPercent, source }) => ({
          factorName,
          contributionPercent,
          tableId: source.tableId,
          sourceRow: source.sourceRow,
        })),
        top1Concentration,
        top3Concentration,
        concentrationAssessment: top1Concentration >= CONTRIBUTOR_POLICY.top1Percent
          || top3Concentration >= CONTRIBUTOR_POLICY.top3Percent
          ? "concentrated"
          : "distributed",
        policyVersion: "f6-contributor-policy-v1",
        evidenceReferences: [structuredClone(f5Reference)],
      },
      rootCauseAnalysis: {
        factBasedFindings,
        ruleFindings,
        optionFindings,
        signals,
        evidenceStatus: factBasedFindings.length > 0 ? "supported" : "insufficient_evidence",
        evidenceReferences: [structuredClone(f5Reference)],
      },
      riskAssessment: buildRisks(f6Worksheet, f5Reference),
      recommendations,
      whatIfAnalysis: {
        options: buildWhatIfOptions(f6Worksheet, f4Reference),
        highestImpactAction,
        roiStatus: f6Worksheet.roiStatus,
        evidenceReferences: uniqueReferences([f4Reference, f5Reference]),
      },
      finalConclusion: [
        `Current design status: ${status}.`,
        `Baseline Cpk ${f6Worksheet.baselineMetrics.cpk}; target Cpk ${f6Worksheet.targetCapability.targetCpk}.`,
        `Largest quantified gap is ${Math.max(f6Worksheet.targetCapability.targetCpk - f6Worksheet.baselineMetrics.cpk, 0)} Cpk.`,
        highestImpactAction,
        `Capability target source: ${targetSource}; target sigma ${f6Worksheet.targetCapability.targetSigmaLevel}.`,
      ],
    },
  };
}

export function createLegacyF6ComposedEngineeringReport(input: F6ComposedEngineeringReportInput): F6ComposedEngineeringReport {
  let f2Report: F2UserReport;
  let f5Report: F5DataInterpretationResult;
  let f6Result: F6OptimizationResult;
  try {
    f2Report = f2UserReportSchema.parse(input.f2Report);
  } catch {
    throw new Error("Invalid F2 report.");
  }
  try {
    f5Report = f5DataInterpretationResultSchema.parse(input.f5Report);
  } catch {
    throw new Error("Invalid F5 report.");
  }
  try {
    f6Result = f6LegacyOptimizationResultSchema.parse(input.f6Result);
  } catch {
    throw new Error("Invalid F6 result.");
  }
  if (f2Report.status === "inputRejected") throw new Error("Invalid F2 report.");
  if (f2Report.workbook.fileName !== f5Report.workbook.fileName
    || f2Report.workbook.fileName !== f6Result.workbook.fileName
    || f2Report.workbook.contentHash !== f5Report.workbook.contentHash
    || f2Report.workbook.contentHash !== f6Result.workbook.contentHash) {
    throw new Error("Workbook identity mismatch.");
  }

  const f5Worksheets = f5Report.worksheets.filter((worksheet): worksheet is CompletedF5Worksheet => worksheet.status === "completed");
  const f6Worksheets = f6Result.worksheets.filter((worksheet): worksheet is ReadyF6Worksheet => worksheet.status !== "input_rejected");
  const f5Names = f5Worksheets.map(({ worksheetName }) => worksheetName);
  const f6Names = f6Worksheets.map(({ worksheetName }) => worksheetName);
  if (!sameNames(f5Names, f6Names)) throw new Error("F5 and F6 selected worksheet identity mismatch.");
  const f2ReadyNames = new Set(f2Report.worksheets.filter(({ status }) => status === "ready").map(({ worksheetName }) => worksheetName));
  if (f5Names.some((name) => !f2ReadyNames.has(name))) throw new Error("Selected worksheet is not F2 ready.");

  const f5WorksheetsByName = new Map(f5Worksheets.map((worksheet) => [worksheet.worksheetName, worksheet]));
  const worksheets = f6Worksheets.map((f6Worksheet) =>
    buildWorksheet(f5WorksheetsByName.get(f6Worksheet.worksheetName)!, f6Worksheet, f6Result.provenance));
  const blockedWorksheets = f2Report.worksheets
    .filter((worksheet) => worksheet.status === "blocked")
    .map((worksheet) => ({
      worksheetName: worksheet.worksheetName,
      findings: [{
        findingCode: "f2_input_blocked",
        findingKind: "validation_abnormality" as const,
        severity: "Critical" as const,
        message: `F2 blocked worksheet; missing or invalid required inputs: ${[
          ...worksheet.missingFieldSummary.map(({ field }) => field),
          ...worksheet.systemSpecificationIssues.map(({ field }) => field),
        ].join(", ") || "controlled validation failure"}.`,
        affectsCapabilityData: true,
        evidenceReferences: [structuredClone(f6Result.provenance.f2Reference)],
      }],
    }));
  const worst = [...worksheets].sort((left, right) =>
    STATUS_RANK[right.status] - STATUS_RANK[left.status]
    || left.sections.capabilityAssessment.metrics.cpk - right.sections.capabilityAssessment.metrics.cpk
    || left.worksheetName.localeCompare(right.worksheetName))[0];
  const overallStatus = worksheets.some(({ status }) => status === "FAIL")
    ? "FAIL"
    : worksheets.some(({ status }) => status === "RISK") || blockedWorksheets.length > 0
      ? "RISK"
      : "PASS";
  const worstMetrics = worst?.sections.capabilityAssessment.metrics;
  const topContributor = worst?.sections.contributorAnalysis.topContributors[0];
  const highestImpact = worst?.sections.whatIfAnalysis.highestImpactAction ?? "Highest Impact Action: insufficient_evidence.";
  const workbookExecutiveSummary = [
    `Overall Status: ${overallStatus}.`,
    worst === undefined ? "Worst worksheet: capability unavailable." : `Worst worksheet: ${worst.worksheetName}; Cpk ${worstMetrics!.cpk}.`,
    worst === undefined ? "Yield/OOS: capability unavailable." : `Yield ${worstMetrics!.yield}; OOS ${1 - worstMetrics!.yield} (${worstMetrics!.dpm} ppm).`,
    topContributor === undefined ? "Top contributor: insufficient_evidence." : `Top contributor: ${topContributor.factorName} (${topContributor.contributionPercent}%).`,
    highestImpact,
  ];

  return immutable(legacyComposedSchema.parse({
    contractVersion: f6Result.contractVersion,
    outputClassification: "confidential",
    reportVersion: "f6-composed-report-v1",
    workbook: f6Result.workbook,
    overallStatus,
    workbookExecutiveSummary,
    blockedWorksheets,
    worksheets,
  }));
}

interface F6ComposedEngineeringReportV2Input {
  readonly f2Report: F2UserReport;
  readonly f5Report: F5DataInterpretationResult;
  readonly f6Result: F6OptimizationResultV2;
  readonly analysisContext?: F6AnalysisContext;
}

type V2Calculation = CompletedF5Worksheet["calculationResult"];
type V2Worksheet = F6OptimizationResultV2["worksheets"][number];
type V2AcceptedF2Report = Exclude<F2UserReport, { status: "inputRejected" }>;
type V2F2ReadyWorksheet = Extract<V2AcceptedF2Report["worksheets"][number], { status: "ready" }>;
type V2SectionKey = keyof F6ComposedEngineeringReportV2["worksheets"][number]["sections"];
type V2DecisionStatus = F6ComposedEngineeringReportV2["worksheets"][number]["status"];

function v2Section<Id extends string>(sectionId: Id, evidenceIds: readonly string[], status: "SUPPORTED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE" | "NOT_APPLICABLE" = "SUPPORTED") {
  return { sectionId, status, evidenceIds: [...evidenceIds] };
}

function v2Quantity(value: number, unit: string) {
  return { value, unit };
}

function v2Range(lower: number, upper: number, unit: string) {
  return { lower, upper, unit };
}

function v2FactorIdentity(factor: V2Calculation["factors"][number]) {
  return {
    worksheetName: factor.source.worksheetName,
    tableId: factor.source.tableId,
    sourceRow: factor.source.sourceRow,
    factorName: factor.factorName,
    unit: factor.unit,
  };
}

function v2NearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function assertV2Baseline(calculation: V2Calculation, worksheet: V2Worksheet): void {
  const identity = worksheet.baselineIdentity;
  if (calculation.calculationVersion !== identity.calculationVersion
    || calculation.projectReference !== identity.projectReference
    || calculation.runReference !== identity.runReference
    || calculation.workbookContentHash !== identity.workbookContentHash
    || calculation.worksheetSelection.worksheetName !== identity.worksheetName
    || calculation.worksheetSelection.tableId !== identity.tableId) {
    throw new Error("F5 and F6 V2 baseline identity mismatch.");
  }
  const expected = {
    mean: calculation.system.mean,
    rssSigma: calculation.system.rssSigma,
    worstCaseLower: calculation.system.worstCaseLower,
    worstCaseUpper: calculation.system.worstCaseUpper,
    cp: calculation.capability.cp,
    cpk: calculation.capability.cpk,
  };
  for (const field of Object.keys(expected) as Array<keyof typeof expected>) {
    if (!v2NearlyEqual(expected[field], worksheet.baselineMetrics[field])) throw new Error("F5 and F6 V2 baseline metrics mismatch.");
  }
}

function buildV2Worksheet(
  f2Worksheet: V2F2ReadyWorksheet,
  f5Worksheet: CompletedF5Worksheet,
  f6Worksheet: V2Worksheet,
  analysisContext: F6AnalysisContext["worksheets"][number] | undefined,
  f6Result: F6OptimizationResultV2,
): F6ComposedEngineeringReportV2["worksheets"][number] {
  const calculation = f5Worksheet.calculationResult;
  assertV2Baseline(calculation, f6Worksheet);
  const unitSet = new Set(calculation.factors.map(({ unit }) => unit));
  if (unitSet.size !== 1) throw new Error("F6 V2 report requires one consistent unit.");
  const unit = calculation.factors[0]!.unit;
  const projection = createF6ReportProjection({ calculation, inputResolution: 1e-12 });
  const baselineEvidenceId = `${f6Worksheet.worksheetName}:f4-baseline`;
  const evidenceIndex: F6ComposedEngineeringReportV2["worksheets"][number]["evidenceIndex"] = [{
    evidenceId: baselineEvidenceId,
    evidenceType: "CALCULATED",
    confidence: "HIGH",
    status: "SUPPORTED",
    description: "Governed F4 baseline calculation and trace.",
    artifactReferences: [structuredClone(f6Result.provenance.f4Reference)],
    sourceRows: calculation.factors.map(({ source }) => structuredClone(source)),
    formulaReferences: calculation.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
    affectsFinalDecision: calculation.capability.status === "FAIL",
    limitations: ["Predictive tolerance model; not measured production capability."],
  }];
  const p1 = (gapId: string, missingInformation: string, affectedSections: V2SectionKey[], verificationMethod: string) => ({
    gapId,
    priority: "P1" as const,
    blocksFinalDecision: false as const,
    missingInformation,
    affectedSections,
    suggestedSource: "Governed TA Analysis Context or measured evidence",
    responsibleRole: "Design or manufacturing engineering role",
    verificationMethod,
    evidenceReferences: [] as Array<{ artifact: string; contentHash: string }>,
  });
  const p2 = (gapId: string, missingInformation: string, affectedSections: V2SectionKey[], verificationMethod: string) => ({
    ...p1(gapId, missingInformation, affectedSections, verificationMethod),
    priority: "P2" as const,
  });
  const dataGaps: F6ComposedEngineeringReportV2["worksheets"][number]["dataGaps"] = [];
  if (analysisContext?.analysisObject === undefined) dataGaps.push(p2(`${f6Worksheet.worksheetName}:analysis-object`, "Structured analysis object was not provided.", ["objectiveAndRequirements"], "Provide f6-analysis-context-v1 analysisObject."));
  if (analysisContext === undefined || analysisContext.operatingConditions.length === 0) dataGaps.push(p1(`${f6Worksheet.worksheetName}:operating-conditions`, "Operating conditions were not provided.", ["operatingConditions", "riskAssessment"], "Confirm assembly, load, temperature and test conditions."));
  if (analysisContext?.loopDefinition === undefined) dataGaps.push(p1(`${f6Worksheet.worksheetName}:loop-definition`, "Loop start, end and signed direction were not provided.", ["toleranceLoopDefinition", "calculationSelfCheck"], "Provide identity-bound signed Loop factors."));
  dataGaps.push(p1(`${f6Worksheet.worksheetName}:measured-capability`, "Measured production capability was not provided.", ["capabilityAssessment"], "Provide stable measured process data and MSA evidence."));
  if (f6Result.provenance.optimizationTargetsDecision.outcome === "NOT_PROVIDED"
    || f6Result.provenance.optimizationTargetsDecision.outcome === "DECLINED"
    || f6Result.provenance.optimizationTargetsDecision.outcome === "REJECTED") {
    dataGaps.push(p1(`${f6Worksheet.worksheetName}:optimization-targets`, "Governed optimization targets were not available.", ["sensitivityAndOptimization", "engineeringRecommendations"], "Provide and confirm f6-optimization-targets-v1."));
  }
  if (analysisContext?.correlationRequirement.mode === "CORRELATED") {
    dataGaps.push({
      gapId: `${f6Worksheet.worksheetName}:correlated-model`, priority: "P0", blocksFinalDecision: true,
      missingInformation: "Correlated covariance calculation is not supported by excel-ta-v1.", affectedSections: ["calculationSelfCheck", "statisticalResults", "capabilityAssessment"],
      suggestedSource: "Approved covariance-capable calculation engine", responsibleRole: "DFSS or tolerance analysis role",
      verificationMethod: "Run a governed covariance model; do not substitute independent RSS.", evidenceReferences: [],
    });
  }
  for (const row of f2Worksheet.rows) {
    if (row.actualFields.drawingNumber === null) dataGaps.push(p2(`${f6Worksheet.worksheetName}:drawing:${row.sourceRow}`, `Drawing Number is missing for source row ${row.sourceRow}.`, ["inputIntegrity", "designIntentReview"], "Confirm the governed drawing identity."));
  }
  const blockingP0GapIds = dataGaps.filter(({ priority }) => priority === "P0").map(({ gapId }) => gapId);
  const conditionalP1GapIds = dataGaps.filter(({ priority }) => priority === "P1").map(({ gapId }) => gapId);
  const supportedFailureEvidenceIds = calculation.capability.status === "FAIL" ? [baselineEvidenceId] : [];
  const openHighRiskIds = calculation.capability.status === "FAIL" ? [`${f6Worksheet.worksheetName}:capability`] : [];
  const baselineDecision = calculation.capability.status;
  const status: V2DecisionStatus = blockingP0GapIds.length > 0 ? "INCOMPLETE"
    : supportedFailureEvidenceIds.length > 0 ? "FAIL"
      : conditionalP1GapIds.length > 0 || openHighRiskIds.length > 0 ? "CONDITIONAL_PASS" : "PASS";
  const factorRows = calculation.factors.map((factor, index) => {
    const f2Row = f2Worksheet.rows.find(({ tableId, sourceRow }) => tableId === factor.source.tableId && sourceRow === factor.source.sourceRow);
    const governance = f5Worksheet.governanceRows.find(({ source }) => source.tableId === factor.source.tableId && source.sourceRow === factor.source.sourceRow);
    return {
      factor: v2FactorIdentity(factor), partName: governance?.partSubsystem ?? null,
      drawingNumber: governance?.drawingNumber ?? null, dimId: governance?.dimId ?? null,
      nominal: v2Quantity(factor.input.nominalValue, unit), mean: v2Quantity(factor.mean, unit),
      upperTolerance: v2Quantity(factor.input.upperTolerance, unit), lowerTolerance: v2Quantity(factor.input.lowerTolerance, unit),
      distribution: factor.input.distribution, sigmaLevel: factor.input.sigmaLevel, sigma: v2Quantity(factor.sigma, unit),
      longTermSafetyFactor: factor.input.longTermSafetyFactor, sourceCells: structuredClone(governance?.source.sourceCells ?? f2Row?.sourceCells ?? {}),
      evidenceId: baselineEvidenceId, confidence: "HIGH" as const, notes: [] as string[], rank: index + 1,
    };
  });
  const contributors = [...factorRows]
    .map((row, index) => ({ rank: index + 1, factor: row.factor, sigma: row.sigma, contributionPercent: calculation.factors.find((factor) => factor.source.sourceRow === row.factor.sourceRow)!.contribution * 100, cumulativePercent: 0, evidenceId: baselineEvidenceId, confidence: "HIGH" as const }))
    .sort((left, right) => right.contributionPercent - left.contributionPercent || left.factor.sourceRow - right.factor.sourceRow);
  let cumulative = 0;
  contributors.forEach((row, index) => { cumulative += row.contributionPercent; row.rank = index + 1; row.cumulativePercent = cumulative; });
  const targetRange = projection.statisticalRanges.find(({ sigmaLevel }) => sigmaLevel === calculation.capability.targetSigmaLevel)!;
  const consistencyDto = (check: typeof projection.selfChecks.mean) => ({
    ...check,
    formulaCheckIds: [...check.formulaCheckIds],
  });
  const formulaCheckDtos = projection.formulaChecks.map((check) => ({
    ...check,
    inputs: check.inputs.map((formulaInput) => ({ ...formulaInput })),
    sourceCells: [...check.sourceCells],
  }));
  const marginDto = (margin: typeof projection.margins.statistical) => ({
    ...margin,
    formulaReferences: margin.formulaReferences.map((reference) => ({ ...reference })),
  });
  const risks = calculation.capability.status === "FAIL" ? [{
    riskId: `${f6Worksheet.worksheetName}:capability`, category: "PRODUCT", rating: "HIGH" as const,
    trigger: "Predictive Cpk is below the governed target.", evidenceIds: [baselineEvidenceId], confidence: "HIGH" as const,
    currentMargin: v2Quantity(projection.margins.statistical.minimumMargin, unit), verificationMethod: "Review specification and measured process capability.",
  }] : [];
  const contextObject = analysisContext?.analysisObject;
  const sections: F6ComposedEngineeringReportV2["worksheets"][number]["sections"] = {
    executiveSummary: { ...v2Section("executive_summary", [baselineEvidenceId]), analysisObject: contextObject?.name ?? null, mean: v2Quantity(calculation.system.mean, unit), rssSigma: v2Quantity(calculation.system.rssSigma, unit), statisticalRange: v2Range(targetRange.range.lower, targetRange.range.upper, unit), worstCaseRange: v2Range(calculation.system.worstCaseLower, calculation.system.worstCaseUpper, unit), minimumMargin: v2Quantity(Math.min(projection.margins.statistical.minimumMargin, projection.margins.worstCase.minimumMargin), unit), predictiveCpk: calculation.capability.cpk, topContributors: contributors.slice(0, 5), primaryRisks: risks.map(({ trigger }) => trigger), decision: status, actionRequired: status !== "PASS" },
    objectiveAndRequirements: { ...v2Section("objective_and_requirements", [baselineEvidenceId], contextObject === undefined ? "PARTIAL" : "SUPPORTED"), analysisObject: contextObject === undefined ? null : { kind: contextObject.kind, name: contextObject.name, physicalMeaning: contextObject.physicalMeaning, measurementDirection: contextObject.measurementDirection, positiveDirectionDefinition: contextObject.positiveDirectionDefinition, negativeDirectionDefinition: contextObject.negativeDirectionDefinition }, target: v2Quantity(calculation.system.designNominal, unit), lsl: v2Quantity(calculation.capability.lowerSpecLimit, unit), usl: v2Quantity(calculation.capability.upperSpecLimit, unit), targetCpk: calculation.capability.targetCpk, requirementIds: analysisContext?.functionalRequirements?.requirementIds ?? [], functionalBoundary: analysisContext?.functionalRequirements?.functionalBoundary ?? null, passFailCriteria: analysisContext?.functionalRequirements?.passFailCriteria ?? null },
    operatingConditions: { ...v2Section("operating_conditions", [], analysisContext?.operatingConditions.length ? "SUPPORTED" : "INSUFFICIENT_EVIDENCE"), conditions: (analysisContext?.operatingConditions ?? []).map((condition) => ({ conditionId: condition.conditionId, category: condition.category, description: condition.description, evidenceId: baselineEvidenceId })) },
    inputIntegrity: { ...v2Section("input_integrity", [baselineEvidenceId], "PARTIAL"), rating: dataGaps.some(({ priority }) => priority === "P0") ? "INSUFFICIENT" as const : dataGaps.length > 0 ? "PARTIALLY_COMPLETE" as const : "COMPLETE" as const, factors: factorRows.map(({ rank: _rank, ...row }) => row), findings: dataGaps.map((gap) => ({ findingId: `finding:${gap.gapId}`, field: gap.affectedSections[0]!, status: "MISSING" as const, message: gap.missingInformation, gapId: gap.gapId })) },
    toleranceLoopDefinition: { ...v2Section("tolerance_loop_definition", [], analysisContext?.loopDefinition === undefined ? "INSUFFICIENT_EVIDENCE" : "SUPPORTED"), start: analysisContext?.loopDefinition?.start ?? null, end: analysisContext?.loopDefinition?.end ?? null, responseDirection: analysisContext?.loopDefinition?.responseDirection ?? null, terms: (analysisContext?.loopDefinition?.factors ?? []).map(({ factor, sign }) => ({ factor: structuredClone(factor), sign, physicalMeaning: null, evidenceId: baselineEvidenceId })), equation: analysisContext?.loopDefinition === undefined ? null : analysisContext.loopDefinition.factors.map(({ factor, sign }) => `${sign === 1 ? "+" : "-"}${factor.factorName}`).join(" "), reviewRequired: analysisContext?.loopDefinition === undefined },
    calculationSelfCheck: { ...v2Section("calculation_self_check", [baselineEvidenceId]), meanCheck: consistencyDto(projection.selfChecks.mean), rssCheck: consistencyDto(projection.selfChecks.rss), rangeChecks: projection.selfChecks.ranges.map(consistencyDto), worstCaseCheck: consistencyDto(projection.selfChecks.worstCase) },
    statisticalResults: { ...v2Section("statistical_results", [baselineEvidenceId]), mean: v2Quantity(calculation.system.mean, unit), adjustedMean: v2Quantity(calculation.system.mean, unit), meanShift: v2Quantity(calculation.system.additionalMeanShift, unit), rssSigma: v2Quantity(calculation.system.rssSigma, unit), ranges: projection.statisticalRanges.map((entry) => ({ sigmaLevel: entry.sigmaLevel, range: { ...entry.range }, formulaCheckId: entry.formulaCheckId })), worstCase: v2Range(calculation.system.worstCaseLower, calculation.system.worstCaseUpper, unit), formulaChecks: formulaCheckDtos },
    specificationAndMargins: { ...v2Section("specification_and_margins", [baselineEvidenceId]), specification: { target: v2Quantity(calculation.system.designNominal, unit), lsl: v2Quantity(calculation.capability.lowerSpecLimit, unit), usl: v2Quantity(calculation.capability.upperSpecLimit, unit), targetCpk: calculation.capability.targetCpk }, assessment: { statistical: marginDto(projection.margins.statistical), worstCase: marginDto(projection.margins.worstCase) }, interferenceStatus: "UNKNOWN" as const },
    capabilityAssessment: { ...v2Section("capability_assessment", [baselineEvidenceId]), basis: "PREDICTIVE_TOLERANCE_MODEL" as const, cp: calculation.capability.cp, lowerCpk: calculation.capability.lowerCpk, upperCpk: calculation.capability.upperCpk, cpk: calculation.capability.cpk, lowerZ: calculation.capability.lowerZ, upperZ: calculation.capability.upperZ, predictedDpm: calculation.factors.every(({ input }) => input.distribution === "normal") ? calculation.capability.totalDpm : null, predictedYield: calculation.factors.every(({ input }) => input.distribution === "normal") ? calculation.capability.yield : null, targetCpk: calculation.capability.targetCpk, result: calculation.capability.status, limitations: ["Predictive tolerance model; not measured production capability."] },
    contributorAnalysis: { ...v2Section("contributor_analysis", [baselineEvidenceId]), contributors, interpretationLimit: "High contribution is not proof of root cause, nonconformance, or supplier capability failure." },
    sensitivityAndOptimization: { ...v2Section("sensitivity_and_optimization", [], f6Worksheet.options.some(({ status: optionStatus }) => optionStatus === "completed") ? "SUPPORTED" : "PARTIAL"), sensitivities: calculation.factors.map((factor) => ({ factor: v2FactorIdentity(factor), responseCoefficient: analysisContext?.loopDefinition?.factors.find(({ factor: identity }) => identity.sourceRow === factor.source.sourceRow)?.sign ?? null, directionStatement: analysisContext?.loopDefinition === undefined ? "Loop direction is unconfirmed." : "Controlled Loop direction.", evidenceId: baselineEvidenceId, reviewRequired: analysisContext?.loopDefinition === undefined })), targets: [], options: structuredClone(f6Worksheet.options), highestImpactAction: f6Worksheet.highestImpactAction?.optionId ?? null, roiStatus: "NOT_COMPUTED" as const },
    riskAssessment: { ...v2Section("risk_assessment", [baselineEvidenceId]), risks },
    engineeringRecommendations: { ...v2Section("engineering_recommendations", [baselineEvidenceId]), mandatoryActions: calculation.capability.status === "FAIL" ? [{ actionId: `${f6Worksheet.worksheetName}:capability-action`, targetFactor: null, targetRiskId: `${f6Worksheet.worksheetName}:capability`, rationale: "Close the supported predictive capability failure.", quantifiedBenefit: null, validationRequired: "Provide a governed target and validate through F4.", sideEffects: [], evidenceIds: [baselineEvidenceId] }] : [], validationActions: dataGaps.map((gap) => ({ actionId: `close:${gap.gapId}`, targetFactor: null, targetRiskId: null, rationale: gap.missingInformation, quantifiedBenefit: null, validationRequired: gap.verificationMethod, sideEffects: [], evidenceIds: [] })), conditionalOptimizations: [] },
    designIntentReview: { ...v2Section("design_intent_review", [baselineEvidenceId], "PARTIAL"), checks: [{ checkId: `${f6Worksheet.worksheetName}:margin`, topic: "Margin", status: projection.margins.statistical.minimumMargin < 0 || projection.margins.worstCase.minimumMargin < 0 ? "NEEDS_REVIEW" as const : "SUPPORTED" as const, finding: `Statistical minimum margin ${projection.margins.statistical.minimumMargin}; WC minimum margin ${projection.margins.worstCase.minimumMargin}.`, evidenceIds: [baselineEvidenceId], gapId: null }] },
    dataGaps: { ...v2Section("data_gaps", [], dataGaps.length > 0 ? "PARTIAL" : "SUPPORTED"), gaps: structuredClone(dataGaps) },
    finalConclusion: { ...v2Section("final_conclusion", [baselineEvidenceId]), summary: `Predictive Cpk ${calculation.capability.cpk} versus target ${calculation.capability.targetCpk}.`, decision: status, basis: calculation.capability.status === "FAIL" ? ["Predictive Cpk is below the governed target."] : ["Predictive baseline meets the governed target."], limitations: dataGaps.map(({ missingInformation }) => missingInformation), nextActions: dataGaps.map(({ verificationMethod }) => verificationMethod), baselineDecision },
  };
  return {
    worksheetName: f6Worksheet.worksheetName, tableId: f6Worksheet.tableId, status, baselineDecision,
    dataGaps, decisionInputs: { blockingP0GapIds, conditionalP1GapIds, supportedFailureEvidenceIds, openHighRiskIds },
    sections, evidenceIndex,
  };
}

export function createF6ComposedEngineeringReport(input: F6ComposedEngineeringReportV2Input): F6ComposedEngineeringReportV2 {
  const f2Report = f2UserReportSchema.parse(input.f2Report);
  const f5Report = f5DataInterpretationResultSchema.parse(input.f5Report);
  const f6Result = f6OptimizationResultSchema.parse(input.f6Result);
  const analysisContext = input.analysisContext === undefined ? undefined : f6AnalysisContextSchema.parse(input.analysisContext);
  if (f2Report.status === "inputRejected") throw new Error("Invalid F2 report.");
  const acceptedF2Report: V2AcceptedF2Report = f2Report;
  if (f2Report.workbook.fileName !== f5Report.workbook.fileName || f2Report.workbook.fileName !== f6Result.workbook.fileName
    || f2Report.workbook.contentHash !== f5Report.workbook.contentHash || f2Report.workbook.contentHash !== f6Result.workbook.contentHash) {
    throw new Error("Workbook identity mismatch.");
  }
  if (analysisContext !== undefined && analysisContext.workbookContentHash !== f6Result.workbook.contentHash) throw new Error("Analysis Context workbook identity mismatch.");
  const f5ByName = new Map(f5Report.worksheets.filter((worksheet): worksheet is CompletedF5Worksheet => worksheet.status === "completed").map((worksheet) => [worksheet.worksheetName, worksheet]));
  const f2ReadyByName = new Map(acceptedF2Report.worksheets.filter((worksheet): worksheet is V2F2ReadyWorksheet => worksheet.status === "ready").map((worksheet) => [worksheet.worksheetName, worksheet]));
  const contextByName = new Map((analysisContext?.worksheets ?? []).map((worksheet) => [worksheet.worksheetName, worksheet]));
  const worksheets = f6Result.worksheets.filter(({ runStatus }) => runStatus !== "INPUT_REJECTED").map((worksheet) => {
    const f2Worksheet = f2ReadyByName.get(worksheet.worksheetName);
    const f5Worksheet = f5ByName.get(worksheet.worksheetName);
    if (f2Worksheet === undefined || f5Worksheet === undefined) throw new Error("Selected worksheet is not ready across F2/F5/F6.");
    return buildV2Worksheet(f2Worksheet, f5Worksheet, worksheet, contextByName.get(worksheet.worksheetName), f6Result);
  });
  const blockedWorksheets = acceptedF2Report.worksheets.filter((worksheet) => worksheet.status === "blocked").map((worksheet) => ({
    worksheetName: worksheet.worksheetName, status: "INCOMPLETE" as const,
    reasons: ["F2 blocked worksheet due to missing or invalid required input."],
    dataGaps: [{ gapId: `${worksheet.worksheetName}:f2-blocked`, priority: "P0" as const, blocksFinalDecision: true as const, missingInformation: "F2 blocked required input.", affectedSections: ["inputIntegrity"], suggestedSource: "Source workbook", responsibleRole: "TA owner", verificationMethod: "Correct F2 blocking inputs and rerun.", evidenceReferences: [structuredClone(f6Result.provenance.f2Reference)] }],
    evidenceReferences: [structuredClone(f6Result.provenance.f2Reference)],
  }));
  const worksheetStatuses = [
    ...blockedWorksheets.map(({ worksheetName }) => ({ worksheetName, status: "INCOMPLETE" as const })),
    ...worksheets.map(({ worksheetName, status }) => ({ worksheetName, status })),
  ];
  const statuses = worksheetStatuses.map(({ status }) => status);
  const overallStatus = statuses.includes("INCOMPLETE") ? "INCOMPLETE"
    : statuses.includes("FAIL") ? "FAIL" : statuses.includes("CONDITIONAL_PASS") ? "CONDITIONAL_PASS" : "PASS";
  const selectedWorksheetNames = worksheetStatuses.map(({ worksheetName }) => worksheetName);
  const worst = worksheets.find(({ baselineDecision }) => baselineDecision === "FAIL") ?? worksheets[0];
  return immutable(f6ComposedEngineeringReportSchema.parse({
    contractVersion: f6Result.contractVersion, outputClassification: "confidential", reportVersion: "f6-composed-report-v2",
    workbook: f6Result.workbook, overallStatus,
    workbookSummary: {
      scope: { selectedWorksheetNames, excludedWorksheetNames: [] }, worksheetStatuses,
      ...(worst === undefined ? {} : { worstSupportedFinding: { worksheetName: worst.worksheetName, baselineDecision: worst.baselineDecision, reason: worst.sections.finalConclusion.summary } }),
      blockingGapCount: blockedWorksheets.reduce((count, worksheet) => count + worksheet.dataGaps.length, 0) + worksheets.reduce((count, worksheet) => count + worksheet.dataGaps.filter(({ priority }) => priority === "P0").length, 0),
      actionRequired: overallStatus !== "PASS",
    },
    blockedWorksheets, worksheets,
  }));
}
