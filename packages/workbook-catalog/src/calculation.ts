import {
  calculationRequestSchema,
  calculationResultSchema,
  calculationScenarioOverrideSchema,
  createTypedError,
  distributionSchema,
  exceptionResolutionResultSchema,
  requiredFieldCheckResultSchema,
  type CalculationRequest,
  type CalculationResult,
  typedErrorSchema,
  worksheetAnalysisAssetsResultSchema,
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
const MAX_FACTOR_ROWS = 100;
const MAX_SCENARIO_FACTOR_EVALUATIONS = 1000;

type CalculationCompletedResult = Extract<CalculationResult, { readonly status: "completed" }>;
type WorksheetRow = CalculationRequest["worksheetAnalysisAssets"]["worksheets"][number]["factorTables"][number]["rows"][number];
type WorksheetField = WorksheetRow["fields"][keyof WorksheetRow["fields"]];
type AvailableWorksheetField = Extract<WorksheetField, { readonly status: "available" }>;
type ScenarioOverride = CalculationRequest["scenarioOverrides"][number];
type ScenarioFactorOverride = ScenarioOverride["factorOverrides"][number];
type ScenarioFactorOverrideField = "nominalValue" | "upperTolerance" | "lowerTolerance" | "longTermSafetyFactor" | "sigmaLevel" | "distribution";
type ScenarioSystemOverrideField = "lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel" | "targetCpk" | "additionalMeanShift";
type BaselineSystemField = "lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel" | "targetCpk" | "additionalMeanShift";

interface NormalizedFactorEntry {
  readonly factor: NormalizedFactor;
  readonly sourceCells: readonly string[];
  readonly sourceCellsByField: Readonly<Record<"nominalValue" | "upperTolerance" | "lowerTolerance" | "longTermSafetyFactor" | "standardDeviation" | "distribution", string>>;
}

interface ScenarioFactorApplication {
  readonly factorIndex: number;
  readonly overrideIndex: number;
  readonly fields: readonly ScenarioFactorOverrideField[];
}

interface BaselineTraceBlueprint {
  readonly outputField: string;
  readonly formulaId: CalculationCompletedResult["traceRecords"][number]["formulaId"];
  readonly dependencies: readonly string[];
}

const FACTOR_OVERRIDE_FIELDS: readonly ScenarioFactorOverrideField[] = [
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "sigmaLevel",
  "distribution",
];

const SYSTEM_OVERRIDE_FIELDS: readonly ScenarioSystemOverrideField[] = [
  "lowerSpecLimit",
  "upperSpecLimit",
  "targetSigmaLevel",
  "targetCpk",
  "additionalMeanShift",
];

const BASELINE_SYSTEM_FIELDS: readonly BaselineSystemField[] = [
  "lowerSpecLimit",
  "upperSpecLimit",
  "targetSigmaLevel",
  "targetCpk",
  "additionalMeanShift",
];

type CalculationRequestErrorCode =
  | "validation_error"
  | "policy_denied"
  | "evidence_mismatch"
  | "prerequisite_not_ready"
  | "calculation_not_possible";

function requestError(summary: string, code: CalculationRequestErrorCode = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: REQUEST_ACTION,
    affectedInputReferences: [CALCULATION_REFERENCE],
  });
}

function completionError(): Error {
  return createTypedError({
    code: "calculation_not_possible",
    summary: COMPLETION_SUMMARY,
    suggestedAction: COMPLETION_ACTION,
    affectedInputReferences: [CALCULATION_REFERENCE],
  });
}

function isTypedError(error: unknown): boolean {
  try {
    return typedErrorSchema.safeParse(error).success;
  } catch {
    return false;
  }
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

function trimNonBlank(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectExcessiveScenarioFactorWorkload(request: unknown): void {
  if (!isPlainRecord(request)) {
    return;
  }

  const worksheetSelection = request.worksheetSelection;
  const worksheetAnalysisAssets = request.worksheetAnalysisAssets;
  const scenarioOverrides = request.scenarioOverrides;
  if (!isPlainRecord(worksheetSelection)
    || !isPlainRecord(worksheetAnalysisAssets)
    || !Array.isArray(worksheetAnalysisAssets.worksheets)
    || !Array.isArray(scenarioOverrides)) {
    return;
  }

  const selectedWorksheet = worksheetAnalysisAssets.worksheets.find((worksheet: unknown) => (
    isPlainRecord(worksheet)
    && worksheet.worksheetName === worksheetSelection.worksheetName
  ));
  if (!isPlainRecord(selectedWorksheet) || !Array.isArray(selectedWorksheet.factorTables)) {
    return;
  }

  const selectedTable = selectedWorksheet.factorTables.find((table: unknown) => (
    isPlainRecord(table)
    && table.tableId === worksheetSelection.tableId
  ));
  if (!isPlainRecord(selectedTable) || !Array.isArray(selectedTable.rows)) {
    return;
  }

  const workload = selectedTable.rows.length * Math.max(1, scenarioOverrides.length);
  if (workload > MAX_SCENARIO_FACTOR_EVALUATIONS) {
    throw requestError(REQUEST_SUMMARY);
  }
}

function asFiniteNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mergeFiniteSystemSpecification(
  baseline: Record<"lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel" | "targetCpk", number>,
  override: Record<string, unknown>,
): Record<"lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel" | "targetCpk", number> | undefined {
  const overrideFields = Object.keys(override);
  if (overrideFields.length === 0
    || overrideFields.some((field) => !SYSTEM_OVERRIDE_FIELDS.includes(field as ScenarioSystemOverrideField))) {
    return undefined;
  }

  const merged = { ...baseline };
  for (const field of SYSTEM_OVERRIDE_FIELDS) {
    const value = override[field];
    if (value === undefined) {
      continue;
    }

    const finite = asFiniteNumberOrUndefined(value);
    if (finite === undefined) {
      return undefined;
    }

    if (field !== "additionalMeanShift") {
      merged[field] = finite;
    }
  }

  return merged;
}

function isSystemSpecificationNotPossible(system: Record<"lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel" | "targetCpk", number>): boolean {
  return system.upperSpecLimit <= system.lowerSpecLimit
    || system.targetSigmaLevel <= 0
    || system.targetCpk <= 0;
}

function classifyInvalidRequestError(request: unknown): CalculationRequestErrorCode {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return "validation_error";
  }

  const topLevel = request as Record<string, unknown>;
  const worksheetAnalysisAssets = worksheetAnalysisAssetsResultSchema.safeParse(topLevel.worksheetAnalysisAssets);
  const requiredFieldCheck = requiredFieldCheckResultSchema.safeParse(topLevel.requiredFieldCheck);
  const exceptionResolution = exceptionResolutionResultSchema.safeParse(topLevel.exceptionResolution);

  if (!worksheetAnalysisAssets.success || !requiredFieldCheck.success || !exceptionResolution.success) {
    return "validation_error";
  }

  const workbookHash = worksheetAnalysisAssets.data.workbook.contentHash;
  if (requiredFieldCheck.data.workbookContentHash !== workbookHash
    || exceptionResolution.data.workbookContentHash !== workbookHash) {
    return "evidence_mismatch";
  }

  if (requiredFieldCheck.data.status === "blocked"
    || exceptionResolution.data.status === "pendingExceptions") {
    return "prerequisite_not_ready";
  }

  const systemSpecification = topLevel.systemSpecification;
  if (isPlainRecord(systemSpecification)) {
    const baselineKeys = Object.keys(systemSpecification);
    const baselineFields = [
      systemSpecification.designNominal,
      systemSpecification.lowerSpecLimit,
      systemSpecification.upperSpecLimit,
      systemSpecification.targetSigmaLevel,
      systemSpecification.targetCpk,
      systemSpecification.additionalMeanShift,
    ];
    const baselineSystem = {
      lowerSpecLimit: asFiniteNumberOrUndefined(systemSpecification.lowerSpecLimit),
      upperSpecLimit: asFiniteNumberOrUndefined(systemSpecification.upperSpecLimit),
      targetSigmaLevel: asFiniteNumberOrUndefined(systemSpecification.targetSigmaLevel),
      targetCpk: asFiniteNumberOrUndefined(systemSpecification.targetCpk),
    };

    const baselineReady = baselineKeys.length === BASELINE_SYSTEM_FIELDS.length + 1
      && baselineKeys.every((field) => field === "designNominal" || BASELINE_SYSTEM_FIELDS.includes(field as BaselineSystemField))
      && baselineFields.every((value) => asFiniteNumberOrUndefined(value) !== undefined)
      && baselineSystem.lowerSpecLimit !== undefined
      && baselineSystem.upperSpecLimit !== undefined
      && baselineSystem.targetSigmaLevel !== undefined
      && baselineSystem.targetCpk !== undefined;

    if (baselineReady) {
      const finiteBaseline = baselineSystem as Record<"lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel" | "targetCpk", number>;
      if (isSystemSpecificationNotPossible(finiteBaseline)) {
        return "calculation_not_possible";
      }

      const scenarioOverrides = topLevel.scenarioOverrides;
      if (Array.isArray(scenarioOverrides)) {
        for (const scenarioOverride of scenarioOverrides) {
          if (!isPlainRecord(scenarioOverride)) {
            continue;
          }

          const scenarioSystem = scenarioOverride.systemSpecification;
          if (!isPlainRecord(scenarioSystem)) {
            continue;
          }


          const structurallyValidScenario = calculationScenarioOverrideSchema.safeParse({
            ...scenarioOverride,
            systemSpecification: {
              ...scenarioSystem,
              ...(typeof scenarioSystem.targetSigmaLevel === "number"
                && Number.isFinite(scenarioSystem.targetSigmaLevel)
                && scenarioSystem.targetSigmaLevel <= 0
                ? { targetSigmaLevel: 1 }
                : {}),
              ...(typeof scenarioSystem.targetCpk === "number"
                && Number.isFinite(scenarioSystem.targetCpk)
                && scenarioSystem.targetCpk <= 0
                ? { targetCpk: 1 }
                : {}),
            },
          });
          if (!structurallyValidScenario.success) {
            continue;
          }

          const merged = mergeFiniteSystemSpecification(finiteBaseline, scenarioSystem);
          if (merged && isSystemSpecificationNotPossible(merged)) {
            return "calculation_not_possible";
          }
        }
      }
    }
  }

  return "validation_error";
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
  const unitField = row.fields.unit;

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

  const numericDeclarations = [
    trimNonBlank(nominalValueField.unit),
    trimNonBlank(upperToleranceField.unit),
    trimNonBlank(lowerToleranceField.unit),
    trimNonBlank(longTermSafetyFactorField.unit),
    trimNonBlank(standardDeviationField.unit),
  ].filter((value): value is string => value !== undefined);
  const explicitDeclarations = unitField && unitField.status === "available"
    ? [trimNonBlank(unitField.rawText), trimNonBlank(unitField.unit)].filter((value): value is string => value !== undefined)
    : [];
  const allUnitDeclarations = [...numericDeclarations, ...explicitDeclarations];
  const distinctUnits = [...new Set(allUnitDeclarations)];

  if (distinctUnits.length > 1) {
    throw requestError(REQUEST_SUMMARY);
  }

  const unit = distinctUnits[0];
  if (!unit) {
    throw requestError(REQUEST_SUMMARY);
  }

  const sourceCellsByField = {
    nominalValue: nominalValueField.sourceCell,
    upperTolerance: upperToleranceField.sourceCell,
    lowerTolerance: lowerToleranceField.sourceCell,
    longTermSafetyFactor: longTermSafetyFactorField.sourceCell,
    standardDeviation: standardDeviationField.sourceCell,
    distribution: distributionField.sourceCell,
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
    sourceCells: unique(Object.values(sourceCellsByField).filter((cell): cell is string => typeof cell === "string" && cell.length > 0)),
  };
}

function createTraceBlueprints(factors: readonly NormalizedFactorEntry[]): readonly BaselineTraceBlueprint[] {
  const blueprints: BaselineTraceBlueprint[] = [];

  for (const [index, factor] of factors.entries()) {
    blueprints.push(
      {
        outputField: `factors[${index}].mean`,
        formulaId: "factor-mean-v1",
        dependencies: [
          factor.sourceCellsByField.nominalValue,
          factor.sourceCellsByField.upperTolerance,
          factor.sourceCellsByField.lowerTolerance,
        ],
      },
      {
        outputField: `factors[${index}].halfTolerance`,
        formulaId: "factor-half-tolerance-v1",
        dependencies: [factor.sourceCellsByField.upperTolerance, factor.sourceCellsByField.lowerTolerance],
      },
      {
        outputField: `factors[${index}].sigma`,
        formulaId: "factor-sigma-v1",
        dependencies: [
          factor.sourceCellsByField.upperTolerance,
          factor.sourceCellsByField.lowerTolerance,
          factor.sourceCellsByField.longTermSafetyFactor,
          factor.sourceCellsByField.standardDeviation,
          factor.sourceCellsByField.distribution,
        ],
      },
    );
  }

  for (const [index] of factors.entries()) {
    blueprints.push({
      outputField: `factors[${index}].contribution`,
      formulaId: "contribution-v1",
      dependencies: factors.map((_factor, sigmaIndex) => `factors[${sigmaIndex}].sigma`),
    });
  }

  blueprints.push(
    {
      outputField: "system.mean",
      formulaId: "system-mean-v1",
      dependencies: [
        ...factors.map((_factor, index) => `factors[${index}].mean`),
        "request:systemSpecification.additionalMeanShift",
      ],
    },
    {
      outputField: "system.worstCaseUpper",
      formulaId: "worst-case-v1",
      dependencies: factors.map((factor) => factor.sourceCellsByField.upperTolerance),
    },
    {
      outputField: "system.worstCaseLower",
      formulaId: "worst-case-v1",
      dependencies: factors.map((factor) => factor.sourceCellsByField.lowerTolerance),
    },
    {
      outputField: "system.rssSigma",
      formulaId: "rss-v1",
      dependencies: factors.map((_factor, index) => `factors[${index}].sigma`),
    },
    {
      outputField: "capability.cp",
      formulaId: "cp-v1",
      dependencies: [
        "request:systemSpecification.lowerSpecLimit",
        "request:systemSpecification.upperSpecLimit",
        "system.rssSigma",
      ],
    },
    {
      outputField: "capability.lowerCpk",
      formulaId: "cpk-lower-v1",
      dependencies: [
        "system.mean",
        "request:systemSpecification.lowerSpecLimit",
        "system.rssSigma",
      ],
    },
    {
      outputField: "capability.upperCpk",
      formulaId: "cpk-upper-v1",
      dependencies: [
        "request:systemSpecification.upperSpecLimit",
        "system.mean",
        "system.rssSigma",
      ],
    },
    {
      outputField: "capability.cpk",
      formulaId: "cpk-v1",
      dependencies: ["capability.lowerCpk", "capability.upperCpk"],
    },
    {
      outputField: "capability.lowerZ",
      formulaId: "z-lower-v1",
      dependencies: ["capability.lowerCpk"],
    },
    {
      outputField: "capability.upperZ",
      formulaId: "z-upper-v1",
      dependencies: ["capability.upperCpk"],
    },
    {
      outputField: "capability.lowerDpm",
      formulaId: "dpm-lower-v1",
      dependencies: ["capability.lowerZ"],
    },
    {
      outputField: "capability.upperDpm",
      formulaId: "dpm-upper-v1",
      dependencies: ["capability.upperZ"],
    },
    {
      outputField: "capability.totalDpm",
      formulaId: "dpm-total-v1",
      dependencies: ["capability.lowerDpm", "capability.upperDpm"],
    },
    {
      outputField: "capability.outOfSpecRatio",
      formulaId: "dpm-total-v1",
      dependencies: ["capability.totalDpm"],
    },
    {
      outputField: "capability.yield",
      formulaId: "yield-v1",
      dependencies: ["capability.totalDpm"],
    },
    {
      outputField: "capability.status",
      formulaId: "status-v1",
      dependencies: ["capability.cpk", "request:systemSpecification.targetCpk"],
    },
  );

  return blueprints;
}

function buildTraceRecords(
  factors: readonly NormalizedFactorEntry[],
  terminalAugmentations?: ReadonlyMap<string, readonly string[]>,
): CalculationCompletedResult["traceRecords"] {
  const blueprints = createTraceBlueprints(factors);
  const blueprintByOutput = new Map(blueprints.map((blueprint) => [blueprint.outputField, blueprint]));
  const memo = new Map<string, readonly string[]>();

  const resolveSources = (outputField: string, visiting: ReadonlySet<string>): readonly string[] => {
    const memoized = memo.get(outputField);
    if (memoized) {
      return memoized;
    }

    if (visiting.has(outputField)) {
      return [];
    }

    const blueprint = blueprintByOutput.get(outputField);
    if (!blueprint) {
      const augmented = terminalAugmentations?.get(outputField) ?? [];
      return unique([outputField, ...augmented]);
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(outputField);

    const resolved: string[] = [];
    for (const dependency of blueprint.dependencies) {
      const nested = blueprintByOutput.has(dependency)
        ? resolveSources(dependency, nextVisiting)
        : unique([dependency, ...(terminalAugmentations?.get(dependency) ?? [])]);
      resolved.push(...nested);
    }

    const deduped = unique(resolved);
    memo.set(outputField, deduped);
    return deduped;
  };

  return blueprints.map((blueprint) => ({
    outputField: blueprint.outputField,
    formulaVersion: CALCULATION_VERSION,
    formulaId: blueprint.formulaId,
    sourceCells: [...resolveSources(blueprint.outputField, new Set())],
  }));
}

function factorKey(source: { worksheetName: string; tableId: string; sourceRow: number }): string {
  return JSON.stringify([source.worksheetName, source.tableId, source.sourceRow]);
}

function runKernel(
  factors: readonly NormalizedFactor[],
  system: {
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    targetCpk: number;
    shift: number;
  },
) {
  try {
    return calculateToleranceAnalysis({ factors, system });
  } catch (error) {
    if (isCalculationKernelError(error)) {
      throw completionError();
    }
    throw error;
  }
}

function buildCalculationPayload(
  kernelResult: ReturnType<typeof calculateToleranceAnalysis>,
  normalizedFactors: readonly NormalizedFactorEntry[],
  criticality: CalculationRequest["criticality"],
  terminalAugmentations?: ReadonlyMap<string, readonly string[]>,
): Pick<CalculationCompletedResult, "factorCount" | "recommendation" | "factors" | "system" | "capability" | "traceRecords"> {
  const traceRecords = buildTraceRecords(normalizedFactors, terminalAugmentations);

  return {
    factorCount: kernelResult.factorCount,
    recommendation: {
      ...kernelResult.recommendation,
      criticality,
      criticalityRisk: criticality !== "none",
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
        sourceCells: [...normalizedFactors[index]!.sourceCells],
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
    traceRecords,
  };
}

function collectScenarioFactorFields(override: ScenarioFactorOverride): ScenarioFactorOverrideField[] {
  return FACTOR_OVERRIDE_FIELDS.filter((field) => override[field] !== undefined);
}

function applyScenarioFactorOverride(
  factor: NormalizedFactor,
  override: ScenarioFactorOverride,
): NormalizedFactor {
  return {
    ...factor,
    input: {
      ...factor.input,
      ...(override.nominalValue !== undefined ? { nominalValue: override.nominalValue } : {}),
      ...(override.upperTolerance !== undefined ? { upperTolerance: override.upperTolerance } : {}),
      ...(override.lowerTolerance !== undefined ? { lowerTolerance: override.lowerTolerance } : {}),
      ...(override.longTermSafetyFactor !== undefined ? { longTermSafetyFactor: override.longTermSafetyFactor } : {}),
      ...(override.sigmaLevel !== undefined ? { sigmaLevel: override.sigmaLevel } : {}),
      ...(override.distribution !== undefined ? { distribution: override.distribution } : {}),
    },
  };
}

function buildScenarioTerminalAugmentationMap(
  scenarioIndex: number,
  appliedFactors: readonly ScenarioFactorApplication[],
  scenario: ScenarioOverride,
  normalizedFactors: readonly NormalizedFactorEntry[],
): ReadonlyMap<string, readonly string[]> {
  const references = new Map<string, string[]>();

  const addReference = (terminalSource: string, reference: string): void => {
    const entries = references.get(terminalSource) ?? [];
    entries.push(reference);
    references.set(terminalSource, entries);
  };

  const factorFieldTerminalMap: Readonly<Record<ScenarioFactorOverrideField, keyof NormalizedFactorEntry["sourceCellsByField"]>> = {
    nominalValue: "nominalValue",
    upperTolerance: "upperTolerance",
    lowerTolerance: "lowerTolerance",
    longTermSafetyFactor: "longTermSafetyFactor",
    sigmaLevel: "standardDeviation",
    distribution: "distribution",
  };

  const baselineSystemTerminals: Readonly<Record<BaselineSystemField, string>> = {
    lowerSpecLimit: "request:systemSpecification.lowerSpecLimit",
    upperSpecLimit: "request:systemSpecification.upperSpecLimit",
    targetSigmaLevel: "request:systemSpecification.targetSigmaLevel",
    targetCpk: "request:systemSpecification.targetCpk",
    additionalMeanShift: "request:systemSpecification.additionalMeanShift",
  };

  for (const applied of appliedFactors) {
    const factorEntry = normalizedFactors[applied.factorIndex];
    if (!factorEntry) {
      continue;
    }

    const baseReference = `request:scenarioOverrides[${scenarioIndex}].factorOverrides[${applied.overrideIndex}]`;
    for (const field of applied.fields) {
      const fieldReference = `${baseReference}.${field}`;
      const terminalField = factorFieldTerminalMap[field];
      addReference(factorEntry.sourceCellsByField[terminalField], fieldReference);
    }
  }

  if (scenario.systemSpecification !== undefined) {
    for (const field of SYSTEM_OVERRIDE_FIELDS) {
      if (scenario.systemSpecification[field] === undefined) {
        continue;
      }

      const reference = `request:scenarioOverrides[${scenarioIndex}].systemSpecification.${field}`;
      addReference(baselineSystemTerminals[field], reference);
    }
  }

  return references;
}

function createScenarioEntry(
  scenarioIndex: number,
  scenario: ScenarioOverride,
  baseline: Pick<CalculationCompletedResult, "runReference" | "factorCount" | "recommendation" | "factors" | "system" | "capability">,
  normalizedFactors: readonly NormalizedFactorEntry[],
  factorIndexByKey: ReadonlyMap<string, number>,
  baselineSystem: {
    designNominal: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    targetCpk: number;
    shift: number;
  },
  criticality: CalculationRequest["criticality"],
): CalculationCompletedResult["scenarios"][number] {
  const scenarioFactors = structuredClone(normalizedFactors.map((entry) => entry.factor));
  const appliedFactors: ScenarioFactorApplication[] = [];

  for (const [overrideIndex, factorOverride] of scenario.factorOverrides.entries()) {
    const key = factorKey(factorOverride);
    const factorIndex = factorIndexByKey.get(key);
    if (factorIndex === undefined) {
      throw requestError(REQUEST_SUMMARY);
    }

    scenarioFactors[factorIndex] = applyScenarioFactorOverride(scenarioFactors[factorIndex]!, factorOverride);
    appliedFactors.push({
      factorIndex,
      overrideIndex,
      fields: collectScenarioFactorFields(factorOverride),
    });
  }

  const scenarioSystem = {
    ...baselineSystem,
    ...(scenario.systemSpecification?.lowerSpecLimit !== undefined ? { lowerSpecLimit: scenario.systemSpecification.lowerSpecLimit } : {}),
    ...(scenario.systemSpecification?.upperSpecLimit !== undefined ? { upperSpecLimit: scenario.systemSpecification.upperSpecLimit } : {}),
    ...(scenario.systemSpecification?.targetSigmaLevel !== undefined ? { targetSigmaLevel: scenario.systemSpecification.targetSigmaLevel } : {}),
    ...(scenario.systemSpecification?.targetCpk !== undefined ? { targetCpk: scenario.systemSpecification.targetCpk } : {}),
    ...(scenario.systemSpecification?.additionalMeanShift !== undefined ? { shift: scenario.systemSpecification.additionalMeanShift } : {}),
  };

  const kernelResult = runKernel(scenarioFactors, scenarioSystem);
  const calculation = buildCalculationPayload(
    kernelResult,
    normalizedFactors,
    criticality,
    buildScenarioTerminalAugmentationMap(scenarioIndex, appliedFactors, scenario, normalizedFactors),
  );

  return {
    scenarioId: scenario.scenarioId,
    baselineRunReference: baseline.runReference,
    calculation,
    overrides: {
      factors: scenario.factorOverrides.map((override) => ({
        source: {
          worksheetName: override.worksheetName,
          tableId: override.tableId,
          sourceRow: override.sourceRow,
        },
        fields: collectScenarioFactorFields(override),
      })),
      ...(scenario.systemSpecification ? { systemSpecification: { ...scenario.systemSpecification } } : {}),
    },
    deltas: {
      mean: calculation.system.mean - baseline.system.mean,
      rssSigma: calculation.system.rssSigma - baseline.system.rssSigma,
      worstCaseUpper: calculation.system.worstCaseUpper - baseline.system.worstCaseUpper,
      worstCaseLower: calculation.system.worstCaseLower - baseline.system.worstCaseLower,
      cpk: calculation.capability.cpk - baseline.capability.cpk,
      totalDpm: calculation.capability.totalDpm - baseline.capability.totalDpm,
      yield: calculation.capability.yield - baseline.capability.yield,
    },
  };
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

  if (table.rows.length > MAX_FACTOR_ROWS) {
    throw requestError(REQUEST_SUMMARY);
  }

  const normalizedFactors = table.rows.map((row) => normalizeFactorRow(row, worksheet.worksheetName, table.tableId));
  const distinctFactorUnits = [...new Set(normalizedFactors.map((entry) => entry.factor.unit))];
  if (distinctFactorUnits.length > 1) {
    throw requestError(REQUEST_SUMMARY);
  }

  const baselineSystem = {
    designNominal: input.systemSpecification.designNominal,
    lowerSpecLimit: input.systemSpecification.lowerSpecLimit,
    upperSpecLimit: input.systemSpecification.upperSpecLimit,
    targetSigmaLevel: input.systemSpecification.targetSigmaLevel,
    targetCpk: input.systemSpecification.targetCpk,
    shift: input.systemSpecification.additionalMeanShift,
  };

  const kernelResult = runKernel(normalizedFactors.map((entry) => entry.factor), baselineSystem);
  const payload = buildCalculationPayload(kernelResult, normalizedFactors, input.criticality);

  const factorIndexByKey = new Map<string, number>();
  for (const [factorIndex, factor] of normalizedFactors.entries()) {
    factorIndexByKey.set(factorKey(factor.factor.source), factorIndex);
  }

  const baseline = {
    runReference: input.runReference,
    factorCount: payload.factorCount,
    recommendation: payload.recommendation,
    factors: payload.factors,
    system: payload.system,
    capability: payload.capability,
  };

  const scenarios = input.scenarioOverrides.map((scenario, scenarioIndex) => createScenarioEntry(
    scenarioIndex,
    scenario,
    baseline,
    normalizedFactors,
    factorIndexByKey,
    baselineSystem,
    input.criticality,
  ));

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
    factorCount: payload.factorCount,
    recommendation: payload.recommendation,
    factors: payload.factors,
    system: payload.system,
    capability: payload.capability,
    traceRecords: payload.traceRecords,
    scenarios,
  };

  const parsed = calculationResultSchema.safeParse(result);
  if (!parsed.success || parsed.data.status !== "completed") {
    throw requestError(REQUEST_SUMMARY);
  }

  return deepFreeze(structuredClone(parsed.data));
}

export function createCalculation(request: unknown): CalculationResult {
  let parsedRequest: ReturnType<typeof calculationRequestSchema.safeParse>;
  try {
    const classification = (request as { inputClassification?: unknown })?.inputClassification;
    if (typeof classification === "string" && classification !== "confidential") {
      throw requestError(POLICY_SUMMARY, "policy_denied");
    }

    rejectExcessiveScenarioFactorWorkload(request);
    parsedRequest = calculationRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw requestError(REQUEST_SUMMARY, classifyInvalidRequestError(request));
    }
  } catch (error) {
    if (isTypedError(error)) {
      throw error;
    }
    throw requestError(REQUEST_SUMMARY);
  }

  return createCompletedResult(parsedRequest.data);
}
