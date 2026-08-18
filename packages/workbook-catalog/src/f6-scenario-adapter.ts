import {
  calculationCompletedResultSchema,
  calculationRequestSchema,
  createTypedError,
  f6ControlledScenarioSchema,
  typedErrorSchema,
  type CalculationCompletedResult,
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
const INTERNAL_SUMMARY = "Controlled F6 scenario processing failed.";
const VALIDATION_ACTION = "Provide one valid confidential F4 baseline and a unique governed F6 scenario.";
const EVIDENCE_ACTION = "Use only worksheet, table, and source-row identities from the selected F4 baseline table.";
const CALCULATION_ACTION = "Review the governed scenario inputs and retry the F4 calculation.";
const INTERNAL_ACTION = "Retry the controlled F6 scenario operation or contact support.";
const MAX_SNAPSHOT_DEPTH = 32;
const MAX_SNAPSHOT_OBJECTS = 50_000;
const MAX_SNAPSHOT_OBJECT_KEYS = 100;
const MAX_SNAPSHOT_ARRAY_LENGTH = 1000;
const MAX_SCENARIO_OVERRIDES = 100;
const MAX_FACTOR_OVERRIDES = 100;
const MAX_SNAPSHOT_STRING_LENGTH = 65_536;
const MAX_SNAPSHOT_TOTAL_STRING_LENGTH = 5_242_880;

interface F6ScenarioCalculationInput {
  readonly baselineRequest: CalculationRequest;
  readonly scenario: F6ControlledScenario;
}

const trustedAdapterErrors = new WeakSet<object>();

function controlledError(
  code: TypedErrorCode,
  summary: string,
  suggestedAction: string,
): Error {
  const error = createTypedError({
    code,
    summary,
    suggestedAction,
    affectedInputReferences: [ADAPTER_REFERENCE],
  });
  trustedAdapterErrors.add(error);
  return error;
}

function validationError(): Error {
  return controlledError("validation_error", VALIDATION_SUMMARY, VALIDATION_ACTION);
}

function internalError(): Error {
  return controlledError("internal_error", INTERNAL_SUMMARY, INTERNAL_ACTION);
}

function snapshotArrayLimit(propertyName: string | undefined): number {
  switch (propertyName) {
    case "scenarioOverrides":
      return MAX_SCENARIO_OVERRIDES;
    case "factorOverrides":
      return MAX_FACTOR_OVERRIDES;
    default:
      return MAX_SNAPSHOT_ARRAY_LENGTH;
  }
}

function createBoundedInputSnapshot(input: unknown): unknown {
  const snapshots = new WeakMap<object, unknown>();
  const active = new WeakSet<object>();
  let objectCount = 0;
  let totalStringLength = 0;

  const snapshot = (value: unknown, depth: number, propertyName?: string): unknown => {
    if (typeof value === "string") {
      totalStringLength += value.length;
      if (value.length > MAX_SNAPSHOT_STRING_LENGTH
        || totalStringLength > MAX_SNAPSHOT_TOTAL_STRING_LENGTH) {
        throw validationError();
      }
      return value;
    }
    if (value === null || typeof value !== "object") return value;
    if (depth > MAX_SNAPSHOT_DEPTH || ++objectCount > MAX_SNAPSHOT_OBJECTS || active.has(value)) {
      throw validationError();
    }

    const existing = snapshots.get(value);
    if (existing !== undefined) return existing;
    active.add(value);

    if (Array.isArray(value)) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      const length = lengthDescriptor?.value;
      if (typeof length !== "number" || length > snapshotArrayLimit(propertyName)) {
        throw validationError();
      }
      const copy: unknown[] = [];
      snapshots.set(value, copy);
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !("value" in descriptor)) throw validationError();
        copy.push(snapshot(descriptor.value, depth + 1));
      }
      active.delete(value);
      return copy;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw validationError();
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_SNAPSHOT_OBJECT_KEYS || keys.some((key) => typeof key !== "string")) {
      throw validationError();
    }
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    snapshots.set(value, copy);
    for (const key of keys) {
      if (typeof key !== "string") throw validationError();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) throw validationError();
      if (!descriptor.enumerable) continue;
      Object.defineProperty(copy, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value: snapshot(descriptor.value, depth + 1, key),
      });
    }
    active.delete(value);
    return copy;
  };

  return snapshot(input, 0);
}

function isTrustedAdapterError(error: unknown): boolean {
  return typeof error === "object" && error !== null && trustedAdapterErrors.has(error);
}

function isCalculationTypedError(error: unknown): boolean {
  return typedErrorSchema.safeParse(error).success;
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
  let baseline: CalculationRequest;
  let scenario: F6ControlledScenario;
  try {
    const snapshot = createBoundedInputSnapshot(input) as {
      readonly baselineRequest?: unknown;
      readonly scenario?: unknown;
    };
    const classification = (snapshot.baselineRequest as { readonly inputClassification?: unknown } | undefined)
      ?.inputClassification;
    if (typeof classification === "string" && classification !== "confidential") {
      throw controlledError("policy_denied", "Controlled F6 scenario input is not permitted.", VALIDATION_ACTION);
    }

    const parsedBaseline = calculationRequestSchema.safeParse(snapshot.baselineRequest);
    const parsedScenario = f6ControlledScenarioSchema.safeParse(snapshot.scenario);
    if (!parsedBaseline.success || !parsedScenario.success) throw validationError();
    validateBaselineSource(parsedBaseline.data, parsedScenario.data);
    baseline = parsedBaseline.data;
    scenario = parsedScenario.data;
  } catch (error) {
    if (isTrustedAdapterError(error)) throw error;
    throw validationError();
  }

  let calculation: CalculationResult;
  try {
    calculation = createCalculation(appendScenario(baseline, scenario));
  } catch (error) {
    if (isCalculationTypedError(error)) throw error;
    throw internalError();
  }

  if (calculation.status !== "completed") {
    throw controlledError("calculation_not_possible", CALCULATION_SUMMARY, CALCULATION_ACTION);
  }
  try {
    const completed = calculationCompletedResultSchema.safeParse(calculation);
    if (!completed.success) throw internalError();
    return immutable(completed.data);
  } catch (error) {
    if (isTrustedAdapterError(error)) throw error;
    throw internalError();
  }
}