import {
  calculationRequestSchema,
  calculationResultSchema,
  createTypedError,
  distributionSchema,
  type CalculationRequest,
  type CalculationResult,
} from "@ai-assist/contracts";
import {
  CALCULATION_VERSION,
  calculateToleranceAnalysis,
  isCalculationKernelError,
  type NormalizedFactor,
} from "./calculation-kernel.js";

const REQUEST_SUMMARY = "Calculation request is invalid.";
const POLICY_SUMMARY = "Calculation input is not permitted.";
const COMPLETION_SUMMARY = "Calculation cannot be completed.";
const REQUEST_ACTION = "Provide valid confidential controlled references.";
const COMPLETION_ACTION = "Provide a valid worksheet selection with calculable factors.";
const CALCULATION_REFERENCE = "calculation-request-v1";

type CalculationCompletedResult = Extract<CalculationResult, { readonly status: "completed" }>;
type WorksheetRow = CalculationRequest["worksheetAnalysisAssets"]["worksheets"][number]["factorTables"][number]["rows"][number];
type WorksheetField = WorksheetRow["fields"][keyof WorksheetRow["fields"]];
type AvailableWorksheetField = Extract<WorksheetField, { readonly status: "available" }>;

interface NormalizedFactorEntry {
  readonly factor: NormalizedFactor;
  readonly sourceCells: readonly string[];
  readonly sourceCellsByField: Readonly<Record<"factorName" | "nominalValue" | "upperTolerance" | "lowerTolerance" | "longTermSafetyFactor" | "standardDeviation" | "distribution" | "unit", string>>;
}

function requestError(summary: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: REQUEST_ACTION,
    affectedInputReferences: [CALCULATION_REFERENCE],
  });
}

function completionError(): Error {
  return createTypedError({
    code: "validation_error",
    summary: COMPLETION_SUMMARY,
    suggestedAction: COMPLETION_ACTION,
    affectedInputReferences: [CALCULATION_REFERENCE],
  });
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested, seen);
    }
    Object.freeze(value);
  }
  return value;
}

function asAvailableField(field: WorksheetField | undefined): AvailableWorksheetField {
  if (!field || field.status !== "available") {
    throw requestError(REQUEST_SUMMARY);
  }
  return field;
}

function asNonBlankText(field: AvailableWorksheetField): string {
  const value = field.rawText.trim();
  if (!value) {
    throw requestError(REQUEST_SUMMARY);
  }
  return value;
}

function asFiniteNumber(field: AvailableWorksheetField): number {
  if (typeof field.numericValue !== "number" || !Number.isFinite(field.numericValue)) {
    throw requestError(REQUEST_SUMMARY);
  }
  return field.numericValue;
}

function unique(sourceCells: readonly string[]): string[] {
  return [...new Set(sourceCells)];
}

function normalizeFactorRow(
  row: WorksheetRow,
  worksheetName: string,
  tableId: string,
): NormalizedFactorEntry {
  const factorNameField = asAvailableField(row.fields.factorName);
  const nominalValueField = asAvailableField(row.fields.nominalValue);
  const upperToleranceField = asAvailableField(row.fields.upperTolerance);
  const lowerToleranceField = asAvailableField(row.fields.lowerTolerance);
  const longTermSafetyFactorField = asAvailableField(row.fields.longTermSafetyFactor);
  const standardDeviationField = asAvailableField(row.fields.standardDeviation);
  const distributionField = asAvailableField(row.fields.distribution);
  const unitField = asAvailableField(row.fields.unit);

  const factorName = asNonBlankText(factorNameField);
  const nominalValue = asFiniteNumber(nominalValueField);
  const upperTolerance = asFiniteNumber(upperToleranceField);
  const lowerTolerance = asFiniteNumber(lowerToleranceField);
  const longTermSafetyFactor = asFiniteNumber(longTermSafetyFactorField);
  const sigmaLevel = asFiniteNumber(standardDeviationField);

  const distributionParsed = distributionSchema.safeParse(asNonBlankText(distributionField).toLowerCase());
  if (!distributionParsed.success) {
    throw requestError(REQUEST_SUMMARY);
  }

  const numericUnits = [
    nominalValueField.unit?.trim(),
    upperToleranceField.unit?.trim(),
    lowerToleranceField.unit?.trim(),
    longTermSafetyFactorField.unit?.trim(),
    standardDeviationField.unit?.trim(),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  const distinctNumericUnits = [...new Set(numericUnits)];
  if (distinctNumericUnits.length > 1) {
    throw requestError(REQUEST_SUMMARY);
  }

  const unit = (distinctNumericUnits[0] ?? asNonBlankText(unitField)).trim();
  if (!unit) {
    throw requestError(REQUEST_SUMMARY);
  }

  const sourceCellsByField = {
    factorName: factorNameField.sourceCell,
    nominalValue: nominalValueField.sourceCell,
    upperTolerance: upperToleranceField.sourceCell,
    lowerTolerance: lowerToleranceField.sourceCell,
    longTermSafetyFactor: longTermSafetyFactorField.sourceCell,
    standardDeviation: standardDeviationField.sourceCell,
    distribution: distributionField.sourceCell,
    unit: unitField.sourceCell,
  } as const;

  return {
    factor: {
      source: {
        worksheetName,
        tableId,
        sourceRow: row.sourceRow,
      },
      name: factorName,
      unit,
      input: {
        nominalValue,
        upperTolerance,
        lowerTolerance,
        longTermSafetyFactor,
        sigmaLevel,
        distribution: distributionParsed.data,
      },
    },
    sourceCellsByField,
    sourceCells: unique(Object.values(sourceCellsByField)),
  };
}

function buildTraceRecords(
  factors: readonly NormalizedFactorEntry[],
): CalculationCompletedResult["traceRecords"] {
  const records: CalculationCompletedResult["traceRecords"] = [];

  for (const [index, factor] of factors.entries()) {
    records.push(
      {
        outputField: `factors[${index}].mean`,
        formulaVersion: CALCULATION_VERSION,
        formulaId: "factor-mean-v1",
        sourceCells: [...factor.sourceCells],
      },
      {
        outputField: `factors[${index}].halfTolerance`,
        formulaVersion: CALCULATION_VERSION,
        formulaId: "factor-half-tolerance-v1",
        sourceCells: [factor.sourceCellsByField.upperTolerance, factor.sourceCellsByField.lowerTolerance],
      },
      {
        outputField: `factors[${index}].sigma`,
        formulaVersion: CALCULATION_VERSION,
        formulaId: "factor-sigma-v1",
        sourceCells: [
          factor.sourceCellsByField.upperTolerance,
          factor.sourceCellsByField.lowerTolerance,
          factor.sourceCellsByField.longTermSafetyFactor,
          factor.sourceCellsByField.standardDeviation,
          factor.sourceCellsByField.distribution,
        ],
      },
      {
        outputField: `factors[${index}].contribution`,
        formulaVersion: CALCULATION_VERSION,
        formulaId: "contribution-v1",
        sourceCells: [factor.sourceCellsByField.standardDeviation],
      },
    );
  }

  const aggregateSourceCells = unique(factors.flatMap((factor) => factor.sourceCells));
  const capabilitySourceCells = [
    ...aggregateSourceCells,
    "systemSpecification.lowerSpecLimit",
    "systemSpecification.upperSpecLimit",
    "systemSpecification.targetSigmaLevel",
    "systemSpecification.targetCpk",
    "systemSpecification.additionalMeanShift",
  ];

  records.push(
    {
      outputField: "system.mean",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "system-mean-v1",
      sourceCells: capabilitySourceCells,
    },
    {
      outputField: "system.worstCaseUpper",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "worst-case-v1",
      sourceCells: factors.map((factor) => factor.sourceCellsByField.upperTolerance),
    },
    {
      outputField: "system.worstCaseLower",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "worst-case-v1",
      sourceCells: factors.map((factor) => factor.sourceCellsByField.lowerTolerance),
    },
    {
      outputField: "system.rssSigma",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "rss-v1",
      sourceCells: factors.map((factor) => factor.sourceCellsByField.standardDeviation),
    },
    {
      outputField: "capability.cp",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "cp-v1",
      sourceCells: capabilitySourceCells,
    },
    {
      outputField: "capability.lowerCpk",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "cpk-lower-v1",
      sourceCells: capabilitySourceCells,
    },
    {
      outputField: "capability.upperCpk",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "cpk-upper-v1",
      sourceCells: capabilitySourceCells,
    },
    {
      outputField: "capability.cpk",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "cpk-v1",
      sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
    },
    {
      outputField: "capability.lowerZ",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "z-lower-v1",
      sourceCells: ["capability.lowerCpk"],
    },
    {
      outputField: "capability.upperZ",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "z-upper-v1",
      sourceCells: ["capability.upperCpk"],
    },
    {
      outputField: "capability.lowerDpm",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "dpm-lower-v1",
      sourceCells: ["capability.lowerZ"],
    },
    {
      outputField: "capability.upperDpm",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "dpm-upper-v1",
      sourceCells: ["capability.upperZ"],
    },
    {
      outputField: "capability.totalDpm",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "dpm-total-v1",
      sourceCells: ["capability.lowerDpm", "capability.upperDpm"],
    },
    {
      outputField: "capability.yield",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "yield-v1",
      sourceCells: ["capability.totalDpm"],
    },
    {
      outputField: "capability.status",
      formulaVersion: CALCULATION_VERSION,
      formulaId: "status-v1",
      sourceCells: ["capability.cpk", "systemSpecification.targetCpk"],
    },
  );

  return records;
}

function createCompletedResult(input: CalculationRequest): CalculationCompletedResult {
  const worksheet = input.worksheetAnalysisAssets.worksheets.find((entry) => entry.worksheetName === input.worksheetSelection.worksheetName);
  if (!worksheet) {
    throw requestError(REQUEST_SUMMARY);
  }

  const table = worksheet.factorTables.find((entry) => entry.tableId === input.worksheetSelection.tableId);
  if (!table) {
    throw requestError(REQUEST_SUMMARY);
  }

  const normalizedFactors = table.rows.map((row) => normalizeFactorRow(row, worksheet.worksheetName, table.tableId));

  let kernelResult;
  try {
    kernelResult = calculateToleranceAnalysis({
      factors: normalizedFactors.map((entry) => entry.factor),
      system: {
        designNominal: input.systemSpecification.designNominal,
        lowerSpecLimit: input.systemSpecification.lowerSpecLimit,
        upperSpecLimit: input.systemSpecification.upperSpecLimit,
        targetSigmaLevel: input.systemSpecification.targetSigmaLevel,
        targetCpk: input.systemSpecification.targetCpk,
        shift: input.systemSpecification.additionalMeanShift,
      },
    });
  } catch (error) {
    if (isCalculationKernelError(error)) {
      throw completionError();
    }
    throw error;
  }

  const result = {
    contractVersion: "v1" as const,
    outputClassification: "confidential" as const,
    featureId: "F4" as const,
    status: "completed" as const,
    calculationVersion: CALCULATION_VERSION,
    projectReference: input.projectReference,
    runReference: input.runReference,
    workbookContentHash: input.worksheetAnalysisAssets.workbook.contentHash,
    worksheetSelection: input.worksheetSelection,
    factorCount: kernelResult.factorCount,
    recommendation: {
      ...kernelResult.recommendation,
      criticality: input.criticality,
      criticalityRisk: input.criticality !== "none",
    },
    factors: kernelResult.factors.map((factor, index) => ({
      factorName: factor.name,
      unit: factor.unit,
      source: factor.source,
      input: factor.input,
      mean: factor.mean,
      halfTolerance: factor.halfTolerance,
      sigma: factor.sigma,
      contribution: factor.contribution,
      trace: {
        formulaIds: [
          "factor-mean-v1",
          "factor-half-tolerance-v1",
          "factor-sigma-v1",
          "contribution-v1",
        ] as const,
        sourceCells: normalizedFactors[index]!.sourceCells,
      },
    })),
    system: {
      designNominal: kernelResult.system.designNominal,
      mean: kernelResult.system.mean,
      additionalMeanShift: kernelResult.system.shift,
      worstCaseUpper: kernelResult.system.worstCaseUpper,
      worstCaseLower: kernelResult.system.worstCaseLower,
      rssSigma: kernelResult.system.rssSigma,
    },
    capability: {
      lowerSpecLimit: kernelResult.capability.lowerSpecLimit,
      upperSpecLimit: kernelResult.capability.upperSpecLimit,
      targetSigmaLevel: kernelResult.capability.targetSigmaLevel,
      targetCpk: kernelResult.capability.targetCpk,
      cp: kernelResult.capability.cp,
      lowerCpk: kernelResult.capability.lowerCpk,
      upperCpk: kernelResult.capability.upperCpk,
      cpk: kernelResult.capability.cpk,
      lowerZ: kernelResult.capability.lowerZ,
      upperZ: kernelResult.capability.upperZ,
      lowerDpm: kernelResult.capability.lowerDpm,
      upperDpm: kernelResult.capability.upperDpm,
      totalDpm: kernelResult.capability.totalDpm,
      outOfSpecRatio: kernelResult.capability.outOfSpecRatio,
      yield: kernelResult.capability.yield,
      status: kernelResult.capability.status,
    },
    traceRecords: buildTraceRecords(normalizedFactors),
    scenarios: [],
  };

  const parsed = calculationResultSchema.safeParse(result);
  if (!parsed.success || parsed.data.status !== "completed") {
    throw requestError(REQUEST_SUMMARY);
  }

  return deepFreeze(structuredClone(parsed.data));
}

export function createCalculation(request: unknown): CalculationResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw requestError(REQUEST_SUMMARY);
  }

  if (typeof classification === "string" && classification !== "confidential") {
    throw requestError(POLICY_SUMMARY, "policy_denied");
  }

  const parsedRequest = calculationRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    throw requestError(REQUEST_SUMMARY);
  }

  if (parsedRequest.data.scenarioOverrides.length > 0) {
    throw requestError(REQUEST_SUMMARY);
  }

  return createCompletedResult(parsedRequest.data);
}
