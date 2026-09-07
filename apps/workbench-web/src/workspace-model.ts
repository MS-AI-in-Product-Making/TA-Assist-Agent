import type {
  F2UserReport,
  F4WorkflowCalculationResult,
  F5DataInterpretationResult,
  F6ReadableOptimizationResult,
} from "@ai-assist/contracts";

import type { WhatIfMetrics } from "./components/MetricComparison.js";
import type { F8SessionSnapshot } from "./workbench-session.js";
import { projectSourceText, type ProjectedText } from "./web-projection.js";

export type WorksheetBusinessStatus = "ready" | "risk" | "blocked" | "modified";

export interface FactorRowModel {
  readonly key: string;
  readonly worksheetName: string;
  readonly tableId: string;
  readonly sourceRow: number;
  readonly factorName: ProjectedText;
  readonly partName: ProjectedText;
  readonly drawingNumber?: string;
  readonly dimId?: string;
  readonly partCategory: string;
  readonly unit: string;
  readonly nominalValue: number;
  readonly nominalDisplay: string;
  readonly upperTolerance: number;
  readonly upperToleranceDisplay: string;
  readonly lowerTolerance: number;
  readonly lowerToleranceDisplay: string;
  readonly longTermSafetyFactor?: number;
  readonly longTermSafetyFactorDisplay: string;
  readonly sigmaLevel?: number;
  readonly sigmaLevelDisplay: string;
  readonly distribution: string;
  readonly mean?: number;
  readonly meanDisplay: string;
  readonly tolerance?: number;
  readonly toleranceDisplay: string;
  readonly oneSigma?: number;
  readonly oneSigmaDisplay: string;
  readonly contributionDisplay: string;
  readonly notes?: string;
  readonly capabilityResult: string;
  readonly knowledgeRecommendation?: ProjectedText;
  readonly imageReference?: { readonly relativePath: string; readonly contentHash: string; readonly worksheetName: string };
  readonly editable: boolean;
  readonly additionalMeanShift: number;
  readonly directionLabel: string;
  readonly directionAvailable: boolean;
  readonly contribution?: number;
  readonly cp?: number;
  readonly cpk?: number;
  readonly loopLabel?: string;
  readonly status: "pass" | "risk" | "blocked" | "modified";
}

export interface WorksheetWorkspaceModel {
  readonly worksheetName: string;
  readonly status: WorksheetBusinessStatus;
  readonly analysisTarget: AnalysisTargetModel;
  readonly factors: readonly FactorRowModel[];
  readonly metrics?: WhatIfMetrics;
  readonly issues: readonly string[];
}

export interface AnalysisTargetModel {
  readonly description: string;
  readonly descriptionReason?: string;
  readonly designNominal: AnalysisTargetFieldModel;
  readonly lowerSpecLimit: AnalysisTargetFieldModel;
  readonly upperSpecLimit: AnalysisTargetFieldModel;
  readonly unit: string;
}

export interface AnalysisTargetFieldModel {
  readonly actual?: number;
  readonly display: string;
  readonly sourceLabel?: string;
  readonly sourceCell?: string;
  readonly reason?: string;
}

export interface EngineeringWorkspaceModel {
  readonly workbookName?: string;
  readonly worksheets: readonly WorksheetWorkspaceModel[];
  readonly selectedWorksheetName?: string;
  readonly preparationMessage?: string;
}

export interface EngineeringWorkspaceInput {
  readonly snapshot?: F8SessionSnapshot;
  readonly f2Report?: F2UserReport;
  readonly f4Report?: F4WorkflowCalculationResult;
  readonly f5Report?: F5DataInterpretationResult;
  readonly f6Report?: F6ReadableOptimizationResult;
  readonly selectedWorksheetName?: string;
}

export function projectEngineeringWorkspace(input: EngineeringWorkspaceInput): EngineeringWorkspaceModel {
  const f2Worksheets = input.f2Report !== undefined && input.f2Report.status !== "inputRejected" ? input.f2Report.worksheets : [];
  const calculations = new Map((input.f4Report?.calculations ?? []).map((calculation) => [calculation.worksheetSelection.worksheetName, calculation]));
  const loopLabelByFactor = buildLoopLabelMap(input.f5Report);
  const worksheetNames = new Set<string>();

  for (const worksheet of f2Worksheets) worksheetNames.add(worksheet.worksheetName);
  if (f2Worksheets.length === 0) {
    for (const worksheetName of input.snapshot?.worksheetCapabilities?.map(({ worksheetName }) => worksheetName) ?? []) worksheetNames.add(worksheetName);
  }
  for (const worksheetName of calculations.keys()) worksheetNames.add(worksheetName);

  const worksheets = [...worksheetNames].map((worksheetName): WorksheetWorkspaceModel => {
    const f2Worksheet = f2Worksheets.find((worksheet) => worksheet.worksheetName === worksheetName);
    const calculation = calculations.get(worksheetName);
    const issues = collectIssues(f2Worksheet);
    const blocked = f2Worksheet !== undefined && f2Worksheet.status !== "ready";
    const analysisTarget = projectAnalysisTarget(f2Worksheet);
    const calculationFactors = new Map((calculation?.factors ?? []).map((factor) => [factorKey(worksheetName, factor.source.tableId, factor.source.sourceRow), factor]));
    const factors = (f2Worksheet?.rows ?? []).map((row): FactorRowModel => {
      const key = factorKey(worksheetName, row.tableId, row.sourceRow);
      const factor = calculationFactors.get(key);
      const actual = row.actualFields;
      const display = row.displayFields;
      const nominalValue = actual.nominalValue ?? factor?.input.nominalValue ?? 0;
      const upperTolerance = actual.upperTolerance ?? factor?.input.upperTolerance ?? 0;
      const lowerTolerance = actual.lowerTolerance ?? factor?.input.lowerTolerance ?? 0;
      const recommendation = projectedRecommendation(row.recommendation);
      return {
        key,
        worksheetName,
        tableId: row.tableId,
        sourceRow: row.sourceRow,
        factorName: projectSourceText(actual.factorName ?? "—", display?.factorName ?? actual.factorName ?? "—"),
        partName: projectSourceText(actual.partName ?? "—", display?.partName ?? actual.partName ?? "—"),
        ...(actual.drawingNumber === null ? {} : { drawingNumber: actual.drawingNumber }),
        ...(actual.dimCharacteristicId === null ? {} : { dimId: actual.dimCharacteristicId }),
        partCategory: actual.partCategory ?? "—",
        unit: factor?.unit ?? "mm",
        nominalValue,
        nominalDisplay: display?.nominalValue ?? displayNumber(actual.nominalValue),
        upperTolerance,
        upperToleranceDisplay: display?.upperTolerance ?? displayNumber(actual.upperTolerance),
        lowerTolerance,
        lowerToleranceDisplay: display?.lowerTolerance ?? displayNumber(actual.lowerTolerance),
        ...(actual.longTermSafetyFactor === null ? {} : { longTermSafetyFactor: actual.longTermSafetyFactor }),
        longTermSafetyFactorDisplay: display?.longTermSafetyFactor ?? displayNumber(actual.longTermSafetyFactor),
        ...(actual.sigmaLevel === null ? {} : { sigmaLevel: actual.sigmaLevel }),
        sigmaLevelDisplay: display?.sigmaLevel ?? displayNumber(actual.sigmaLevel),
        distribution: display?.distribution ?? actual.distribution ?? "—",
        ...(actual.mean === null ? {} : { mean: actual.mean }),
        meanDisplay: display?.mean ?? displayNumber(actual.mean),
        ...(actual.tolerance === null ? {} : { tolerance: actual.tolerance }),
        toleranceDisplay: display?.tolerance ?? displayNumber(actual.tolerance),
        ...(actual.oneSigma === null ? {} : { oneSigma: actual.oneSigma }),
        oneSigmaDisplay: display?.oneSigma ?? displayNumber(actual.oneSigma),
        contributionDisplay: display?.percentContributionToSigma ?? displayPercent(actual.percentContributionToSigma),
        ...(actual.notes === null ? {} : { notes: actual.notes }),
        capabilityResult: capabilityLabel(row.capabilityStatus),
        ...(recommendation === undefined ? {} : { knowledgeRecommendation: recommendation }),
        ...(row.imageReference === undefined ? {} : { imageReference: row.imageReference }),
        editable: factor !== undefined,
        additionalMeanShift: calculation?.system.additionalMeanShift ?? 0,
        directionLabel: "Direction evidence unavailable",
        directionAvailable: false,
        ...(factor?.contribution === undefined ? {} : { contribution: factor.contribution }),
        ...(loopLabelByFactor.get(key) === undefined ? {} : { loopLabel: loopLabelByFactor.get(key) }),
        status: blocked ? "blocked" : calculation?.capability.status === "PASS" ? "pass" : calculation === undefined ? "blocked" : "risk",
      };
    });
    const metrics = calculation === undefined ? undefined : calculationMetrics(calculation);
    return {
      worksheetName,
      status: blocked ? "blocked" : calculation?.capability.status === "FAIL" ? "risk" : "ready",
      analysisTarget,
      factors,
      ...(metrics === undefined ? {} : { metrics }),
      issues,
    };
  });

  const requestedWorksheet = input.selectedWorksheetName;
  const selectedWorksheetName = requestedWorksheet !== undefined && worksheets.some(({ worksheetName }) => worksheetName === requestedWorksheet)
    ? requestedWorksheet
    : worksheets.find(({ status }) => status === "ready")?.worksheetName
      ?? worksheets.find(({ status }) => status === "risk")?.worksheetName
      ?? worksheets[0]?.worksheetName;
  const workbookName = input.f4Report?.source.workbookFileName.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-/i, "");
  const preparing = input.snapshot !== undefined
    && input.snapshot.inputRevision > 0
    && !["created", "workbook_required", "ado_decision_required", "ado_action_pending", "review_required", "completed"].includes(input.snapshot.state)
    && calculations.size === 0;

  return {
    ...(workbookName === undefined ? {} : { workbookName }),
    worksheets,
    ...(selectedWorksheetName === undefined ? {} : { selectedWorksheetName }),
    ...(preparing ? { preparationMessage: "Preparing TA workspace..." } : {}),
  };
}

function calculationMetrics(calculation: F4WorkflowCalculationResult["calculations"][number]): WhatIfMetrics {
  return {
    mean: calculation.system.mean,
    rssSigma: calculation.system.rssSigma,
    cp: calculation.capability.cp,
    cpkL: calculation.capability.lowerCpk,
    cpkU: calculation.capability.upperCpk,
    cpk: calculation.capability.cpk,
    statisticalMargin: Math.min(
      calculation.system.mean - calculation.capability.lowerSpecLimit,
      calculation.capability.upperSpecLimit - calculation.system.mean,
    ),
    worstCaseMargin: Math.min(
      calculation.system.worstCaseLower - calculation.capability.lowerSpecLimit,
      calculation.capability.upperSpecLimit - calculation.system.worstCaseUpper,
    ),
    lowerSpecLimit: calculation.capability.lowerSpecLimit,
    upperSpecLimit: calculation.capability.upperSpecLimit,
    meanShift: calculation.system.additionalMeanShift,
    yield: calculation.capability.yield,
    dpm: calculation.capability.totalDpm,
    statisticalLower: calculation.system.mean - calculation.system.rssSigma * calculation.capability.targetSigmaLevel,
    statisticalUpper: calculation.system.mean + calculation.system.rssSigma * calculation.capability.targetSigmaLevel,
    worstCaseLower: calculation.system.worstCaseLower,
    worstCaseUpper: calculation.system.worstCaseUpper,
  };
}

function collectIssues(worksheet: F2CompletedWorksheet | undefined): string[] {
  if (worksheet === undefined) return [];
  const issues = worksheet.systemSpecificationIssues.map(({ reasonCode }) => reasonCode);
  if (worksheet.tolerancePathImageStatus === "unavailable") issues.push("tolerance_path_image_unavailable");
  issues.push(...(worksheet.f4CalculabilityIssues ?? []).map(({ reasonCode }) => reasonCode));
  for (const row of worksheet.rows) issues.push(...row.missingRequiredFields);
  return [...new Set(issues)];
}

function projectAnalysisTarget(worksheet: F2CompletedWorksheet | undefined): AnalysisTargetModel {
  const description = worksheet?.toleranceLoopDescription?.trim();
  const specification = worksheet?.systemSpecification;
  const unit = "mm";

  return {
    description: description ?? "Not available",
    ...(description === undefined ? { descriptionReason: "Tolerance loop description is missing from the worksheet evidence." } : {}),
    designNominal: projectSystemSpecificationField(specification?.designNominal, specification),
    lowerSpecLimit: projectSystemSpecificationField(specification?.lowerSpecLimit, specification),
    upperSpecLimit: projectSystemSpecificationField(specification?.upperSpecLimit, specification),
    unit,
  };
}

type F2CompletedReport = Extract<F2UserReport, { status: "completed" }>;
type F2CompletedWorksheet = F2CompletedReport["worksheets"][number];

function factorKey(worksheetName: string, tableId: string, sourceRow: number): string {
  return `${worksheetName}\u0000${tableId}\u0000${sourceRow}`;
}

function buildLoopLabelMap(f5Report: F5DataInterpretationResult | undefined): ReadonlyMap<string, string> {
  const labelsByKey = new Map<string, Set<string>>();
  for (const worksheet of f5Report?.worksheets ?? []) {
    if (worksheet.status !== "completed") continue;
    for (const statement of worksheet.statements) {
      if (statement.type !== "SIGNAL") continue;
      if (!("signalKind" in statement.content) || statement.content.signalKind !== "image_text_context_review") continue;
      for (const linkedLabel of statement.content.linkedVisualLabels) {
        const key = factorKey(worksheet.worksheetName, linkedLabel.tableId, linkedLabel.sourceRow);
        const labels = labelsByKey.get(key) ?? new Set<string>();
        labels.add(linkedLabel.label);
        labelsByKey.set(key, labels);
      }
    }
  }
  const resolved = new Map<string, string>();
  for (const [key, labels] of labelsByKey) {
    if (labels.size === 1) resolved.set(key, [...labels][0]!);
  }
  return resolved;
}

function canonicalNumber(value: number): number {
  return Number(value.toFixed(12));
}

function analysisTargetReason(specification: F2CompletedWorksheet["systemSpecification"] | undefined): string {
  if (specification === undefined) return "Worksheet system specification is unavailable.";
  if (specification.status === "unavailable") return systemSpecificationReason(specification.reasonCode);
  return "Worksheet system specification is incomplete.";
}

function projectSystemSpecificationField(
  field:
    | F2CompletedWorksheet["systemSpecification"]["designNominal"]
    | F2CompletedWorksheet["systemSpecification"]["lowerSpecLimit"]
    | F2CompletedWorksheet["systemSpecification"]["upperSpecLimit"]
    | undefined,
  specification: F2CompletedWorksheet["systemSpecification"] | undefined,
): AnalysisTargetFieldModel {
  if (field?.status === "available") {
    return {
      actual: field.actualValue,
      display: field.displayValue,
      sourceLabel: field.sourceLabel,
      ...(field.sourceCell === undefined ? {} : { sourceCell: field.sourceCell }),
    };
  }
  return {
    display: "Not available",
    reason: field?.status === "unavailable" ? worksheetEvidenceReason(field.reasonCode) : analysisTargetReason(specification),
  };
}

function systemSpecificationReason(reasonCode: string): string {
  const messages: Record<string, string> = {
    response_summary_label_missing: "Worksheet system specification labels are missing.",
    response_summary_label_ambiguous: "Worksheet system specification labels are ambiguous.",
    system_specification_range_invalid: "Worksheet system specification limits are invalid.",
    legacy_artifact_missing_system_specification: "Worksheet system specification is not available in this artifact version.",
  };
  return messages[reasonCode] ?? "Worksheet system specification is unavailable.";
}

function worksheetEvidenceReason(reasonCode: string): string {
  const messages: Record<string, string> = {
    response_summary_label_missing: "The worksheet summary label is missing.",
    response_summary_label_ambiguous: "The worksheet summary label is ambiguous.",
    response_summary_value_missing: "The worksheet summary value is missing.",
    response_summary_value_invalid: "The worksheet summary value is invalid.",
  };
  return messages[reasonCode] ?? "The worksheet summary value is unavailable.";
}

function displayNumber(value: number | null): string {
  return value === null ? "—" : String(value);
}

function displayPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function capabilityLabel(status: string): string {
  return ({ internal_within_guidance: "Internal within guidance", internal_guidance_exceeded: "Internal guidance exceeded", f0_information_insufficient: "Information insufficient", non_f0_process_category: "Unrecognized process category", unable_to_check: "Unable to check" } as Record<string, string>)[status] ?? status;
}

function recommendationText(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const recommendation = value as Record<string, unknown>;
  const maximum = recommendation.maximumRecommendedTotalBand;
  const unit = recommendation.unit;
  const version = recommendation.matchedEntryId;
  return typeof maximum === "number" && typeof unit === "string" && typeof version === "string"
    ? `Maximum total tolerance band ${maximum} ${unit} · internal-v1 · ${version}`
    : undefined;
}

function projectedRecommendation(value: unknown): ProjectedText | undefined {
  const sourceText = recommendationText(value);
  if (sourceText === undefined) return undefined;
  return projectSourceText(sourceText);
}
