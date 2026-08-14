import {
  calculationCompletedResultSchema,
  calculationRequestSchema,
  createTypedError,
  f6ControlledScenarioSchema,
  type CalculationRequest,
  type CalculationResult,
  type F6ControlledScenario,
  type TypedErrorCode,
} from "@ai-assist/contracts";
import { createCalculation } from "./calculation.js";

const ADAPTER_REFERENCE = "f6-controlled-scenario-v1";
const VALIDATION_SUMMARY = "Controlled F6 scenario input is invalid.";
const EVIDENCE_SUMMARY = "Controlled F6 scenario source does not match the selected baseline source.";
const CALCULATION_SUMMARY = "Controlled F6 scenario calculation could not be completed.";
const VALIDATION_ACTION = "Provide one valid confidential F4 baseline and a unique governed F6 scenario.";
const EVIDENCE_ACTION = "Use only worksheet, table, and source-row identities from the selected F4 baseline table.";
const CALCULATION_ACTION = "Review the governed scenario inputs and retry the F4 calculation.";

type CalculationCompletedResult = Extract<CalculationResult, { readonly status: "completed" }>;

interface F6ScenarioCalculationInput {
  readonly baselineRequest: unknown;
  readonly scenario: unknown;
}

function controlledError(
  code: TypedErrorCode,
  summary: string,
  suggestedAction: string,
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction,
    affectedInputReferences: [ADAPTER_REFERENCE],
  });
}

function validationError(): Error {
  return controlledError("validation_error", VALIDATION_SUMMARY, VALIDATION_ACTION);
}

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

function sourceKey(source: {
  readonly worksheetName: string;
  readonly tableId: string;
  readonly sourceRow: number;
}): string {
  return JSON.stringify([source.worksheetName, source.tableId, source.sourceRow]);
}

function validateBaselineSource(
  baseline: CalculationRequest,
  scenario: F6ControlledScenario,
): void {
  if (baseline.worksheetAnalysisAssets.worksheets.length !== 1) throw validationError();
  if (baseline.scenarioOverrides.some((entry) => entry.scenarioId === scenario.scenarioId)) {
    throw validationError();
  }

  const worksheet = baseline.worksheetAnalysisAssets.worksheets[0];
  if (worksheet === undefined) throw validationError();
  const selectedTable = worksheet?.worksheetName === baseline.worksheetSelection.worksheetName
    ? worksheet.factorTables.find((table) => table.tableId === baseline.worksheetSelection.tableId)
    : undefined;
  if (selectedTable === undefined) throw validationError();

  const selectedSources = new Set(selectedTable.rows.map((row) => sourceKey({
    worksheetName: worksheet.worksheetName,
    tableId: selectedTable.tableId,
    sourceRow: row.sourceRow,
  })));
  const scenarioSources = scenario.factorOverrides.map(sourceKey);
  if (new Set(scenarioSources).size !== scenarioSources.length) throw validationError();
  if (scenarioSources.some((key) => !selectedSources.has(key))) {
    throw controlledError("evidence_mismatch", EVIDENCE_SUMMARY, EVIDENCE_ACTION);
  }
}

function appendScenario(
  baseline: CalculationRequest,
  scenario: F6ControlledScenario,
): CalculationRequest {
  const scenarioOverride: CalculationRequest["scenarioOverrides"][number] = {
    scenarioId: scenario.scenarioId,
    factorOverrides: structuredClone(scenario.factorOverrides),
    ...(scenario.systemSpecification === undefined
      ? {}
      : { systemSpecification: structuredClone(scenario.systemSpecification) }),
  };
  return {
    ...structuredClone(baseline),
    scenarioOverrides: [
      ...structuredClone(baseline.scenarioOverrides),
      scenarioOverride,
    ],
  };
}

export function calculateF6Scenario(input: F6ScenarioCalculationInput): CalculationCompletedResult {
  const classification = (input?.baselineRequest as { readonly inputClassification?: unknown } | undefined)
    ?.inputClassification;
  if (typeof classification === "string" && classification !== "confidential") {
    throw controlledError("policy_denied", "Controlled F6 scenario input is not permitted.", VALIDATION_ACTION);
  }

  const baseline = calculationRequestSchema.safeParse(input?.baselineRequest);
  const scenario = f6ControlledScenarioSchema.safeParse(input?.scenario);
  if (!baseline.success || !scenario.success) throw validationError();
  validateBaselineSource(baseline.data, scenario.data);

  let calculation: CalculationResult;
  try {
    calculation = createCalculation(appendScenario(baseline.data, scenario.data));
  } catch {
    throw controlledError("calculation_not_possible", CALCULATION_SUMMARY, CALCULATION_ACTION);
  }

  const completed = calculationCompletedResultSchema.safeParse(calculation);
  if (!completed.success) {
    throw controlledError("calculation_not_possible", CALCULATION_SUMMARY, CALCULATION_ACTION);
  }
  return immutable(completed.data);
}