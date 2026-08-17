import {
  f2UserReportSchema,
  f5DataInterpretationResultSchema,
  f6ComposedEngineeringReportSchema,
  f6OptimizationResultSchema,
  type F2UserReport,
  type F5DataInterpretationResult,
  type F6ComposedEngineeringReport,
  type F6OptimizationResult,
  type F6Option,
} from "@ai-assist/contracts";

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
  return findings.some(({ findingCode }) => [
    "confirmed_requirement_violation",
    "requirement_violation",
    "specification_violation",
  ].includes(findingCode));
}

function worksheetStatus(
  worksheet: ReadyF6Worksheet,
  confirmedRequirementViolation: boolean,
  missingCapabilityData: boolean,
): "PASS" | "FAIL" | "RISK" {
  if (confirmedRequirementViolation) return "FAIL";
  if (missingCapabilityData) return "RISK";
  if (worksheet.baselineMetrics.cpk < 1) return "FAIL";
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
  const missingCapabilityData = f6Worksheet.inputFindings.some(({ affectsCapabilityData }) => affectsCapabilityData);
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

export function createF6ComposedEngineeringReport(input: F6ComposedEngineeringReportInput): F6ComposedEngineeringReport {
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
    f6Result = f6OptimizationResultSchema.parse(input.f6Result);
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

  return immutable(f6ComposedEngineeringReportSchema.parse({
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
