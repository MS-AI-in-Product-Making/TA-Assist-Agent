import { useEffect, useRef, useState } from "react";

import type { F8ScenarioDraft } from "@ai-assist/contracts";

import type { WorkbenchApi } from "../api.js";
import type { WhatIfCalculationResult, WhatIfValues } from "../components/WhatIfEditor.js";
import { clampSpecDraft } from "../specification-drag.js";
import type { FactorRowModel } from "../workspace-model.js";

export interface FactorScenarioState {
  readonly values: Record<keyof WhatIfValues, string>;
  readonly dirty: boolean;
  readonly calculating: boolean;
  readonly error?: string;
  readonly lastValidResult?: WhatIfCalculationResult;
  readonly calculated?: { readonly mean: number; readonly tolerance: number; readonly oneSigma: number; readonly contribution: number };
}

export function useScenarioWorkspace(input: {
  readonly api: WorkbenchApi;
  readonly sessionId?: string;
  readonly inputRevision?: number;
  readonly factors: readonly FactorRowModel[];
  readonly baselineSystem?: { readonly lowerSpecLimit?: number; readonly upperSpecLimit?: number };
  readonly initialScenarioDraft?: F8ScenarioDraft;
  readonly onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [states, setStates] = useState<ReadonlyMap<string, FactorScenarioState>>(() => createStates(input.factors, input.initialScenarioDraft));
  const [systemValues, setSystemValues] = useState(() => systemValuesFor(input.baselineSystem, input.initialScenarioDraft));
  const [systemSpecificationError, setSystemSpecificationError] = useState<string>();
  const [scenarioResult, setScenarioResult] = useState<WhatIfCalculationResult | undefined>(() => scenarioResultFor(input.initialScenarioDraft));
  const statesRef = useRef(states);
  const systemValuesRef = useRef(systemValues);
  const lastValidDraftRef = useRef<F8ScenarioDraft | undefined>(input.initialScenarioDraft);
  const timers = useRef(new Map<string, number>());
  const sequence = useRef(0);
  const draftIds = useRef(new Map<string, string>());
  const history = useRef<ReadonlyMap<string, FactorScenarioState>[]>([]);

  const factorIdentity = input.factors.map((factor) => `${factor.key}:${factor.nominalValue}:${factor.upperTolerance}:${factor.lowerTolerance}:${factor.additionalMeanShift}`).join("|");
  const baselineSystemIdentity = `${input.baselineSystem?.lowerSpecLimit ?? ""}:${input.baselineSystem?.upperSpecLimit ?? ""}`;
  const initialScenarioIdentity = `${input.initialScenarioDraft?.draftId ?? ""}:${input.initialScenarioDraft?.inputRevision ?? ""}:${input.initialScenarioDraft?.status ?? ""}`;

  useEffect(() => {
    const next = createStates(input.factors, input.initialScenarioDraft);
    statesRef.current = next;
    setStates(next);
    history.current = [];
    const nextSystemValues = systemValuesFor(input.baselineSystem, input.initialScenarioDraft);
    systemValuesRef.current = nextSystemValues;
    setSystemValues(nextSystemValues);
    lastValidDraftRef.current = input.initialScenarioDraft;
    setScenarioResult(scenarioResultFor(input.initialScenarioDraft));
    setSystemSpecificationError(undefined);
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
    return () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    };
  }, [factorIdentity, baselineSystemIdentity, initialScenarioIdentity]);

  const updateStates = (update: (current: ReadonlyMap<string, FactorScenarioState>) => ReadonlyMap<string, FactorScenarioState>) => {
    setStates((current) => {
      const next = update(current);
      statesRef.current = next;
      return next;
    });
  };

  const edit = (factorKey: string, field: keyof WhatIfValues, rawValue: string) => {
    updateStates((current) => {
      const state = current.get(factorKey);
      if (state === undefined) return current;
      history.current.push(current);
      const next = new Map(current);
      next.set(factorKey, { ...state, values: { ...state.values, [field]: rawValue }, dirty: true, error: undefined });
      return next;
    });
  };

  const commit = (factorKey: string) => {
    scheduleWorksheetPreview(factorKey);
  };

  const calculate = async (factorKey: string, options?: { readonly mode?: "factor" | "system"; readonly systemSpecification?: { readonly lowerSpecLimit: number; readonly upperSpecLimit: number } }) => {
    const factor = input.factors.find(({ key }) => key === factorKey) ?? input.factors[0];
    if (factor === undefined || input.sessionId === undefined || input.inputRevision === undefined) {
      if (options?.mode === "system") setSystemSpecificationError("Enter a valid numeric value");
      else setFactorError(factorKey, "Enter a valid numeric value");
      return;
    }
    const overrides = [];
    let additionalMeanShift: number | undefined;
    for (const candidate of input.factors) {
      const state = statesRef.current.get(candidate.key);
      const values = state === undefined ? undefined : parseValues(state.values);
      if (state?.dirty && values === undefined) { setFactorError(candidate.key, "Enter a valid numeric value"); return; }
      if (values === undefined) continue;
      const patch = createPatch(candidate, values);
      if (patch.additionalMeanShift !== undefined) additionalMeanShift = patch.additionalMeanShift;
      const { additionalMeanShift: _meanShift, ...factorPatch } = patch;
      if (Object.keys(factorPatch).length > 0) overrides.push({ worksheetName: candidate.worksheetName, tableId: candidate.tableId, sourceRow: candidate.sourceRow, ...factorPatch });
    }
    const lowerSpecLimit = options?.systemSpecification?.lowerSpecLimit ?? Number(systemValuesRef.current.lowerSpecLimit);
    const upperSpecLimit = options?.systemSpecification?.upperSpecLimit ?? Number(systemValuesRef.current.upperSpecLimit);
    const specificationChanged = Number.isFinite(lowerSpecLimit) && Number.isFinite(upperSpecLimit) && (lowerSpecLimit !== input.baselineSystem?.lowerSpecLimit || upperSpecLimit !== input.baselineSystem?.upperSpecLimit);
    if (overrides.length === 0 && additionalMeanShift === undefined && !specificationChanged) return;
    const currentSequence = ++sequence.current;
    updateStates((current) => new Map([...current].map(([key, candidate]) => [key, candidate.dirty ? { ...candidate, calculating: true, error: undefined } : candidate])));
    try {
      const draft = await input.api.calculateWorksheetWhatIf(input.sessionId, {
        draftId: draftIdFor(factor.worksheetName, input.inputRevision),
        worksheetName: factor.worksheetName,
        inputRevision: input.inputRevision,
        factorOverrides: overrides,
        ...(!specificationChanged && additionalMeanShift === undefined ? {} : { systemSpecification: { ...(specificationChanged ? { lowerSpecLimit, upperSpecLimit } : {}), ...(additionalMeanShift === undefined ? {} : { additionalMeanShift }) } }),
        ...(overrides.some((override) => override.nominalValue !== undefined) ? { signedDirectionEvidence: true as const } : {}),
      });
      if (sequence.current !== currentSequence) return;
      if (draft.calculationReference === undefined || draft.calculationMetrics === undefined) throw new Error("Incomplete calculation");
      const results = new Map((draft.factorResults ?? []).map((result) => [`${result.worksheetName}\u0000${result.tableId}\u0000${result.sourceRow}`, result]));
      lastValidDraftRef.current = draft;
      setScenarioResult({ status: "completed", calculationReference: draft.calculationReference, metrics: draft.calculationMetrics });
      setSystemSpecificationError(undefined);
      updateStates((current) => new Map([...current].map(([key, candidate]) => [key, { ...candidate, calculating: false, ...(results.get(key) === undefined ? {} : { calculated: results.get(key) }), lastValidResult: { status: "completed", calculationReference: draft.calculationReference!, metrics: draft.calculationMetrics! } }])));
    } catch {
      if (sequence.current !== currentSequence) return;
      if (options?.mode === "system") setSystemSpecificationError("Preview failed. The last valid result was kept.");
      else setFactorError(factorKey, "Preview failed. The last valid result was kept.");
    }
  };

  const undo = () => {
    const previous = history.current.pop();
    if (previous !== undefined) { statesRef.current = previous; setStates(previous); }
  };
  const reset = (factorKey?: string) => {
    if (factorKey === undefined) {
      const nextSystemValues = { lowerSpecLimit: String(input.baselineSystem?.lowerSpecLimit ?? ""), upperSpecLimit: String(input.baselineSystem?.upperSpecLimit ?? "") };
      systemValuesRef.current = nextSystemValues;
      setSystemValues(nextSystemValues);
      setSystemSpecificationError(undefined);
    }
    updateStates((current) => factorKey === undefined ? createStates(input.factors) : updateState(current, factorKey, () => stateFor(input.factors.find(({ key }) => key === factorKey)!)));
  };
  const save = async (factorKey?: string) => {
    const factor = input.factors.find(({ key }) => key === factorKey) ?? input.factors[0];
    if (factor === undefined) return;
    const state = statesRef.current.get(factorKey);
    const values = state === undefined ? undefined : parseValues(state.values);
    if (input.inputRevision === undefined || lastValidDraftRef.current?.calculationReference === undefined) return;
    const patch = values === undefined ? {} : createPatch(factor, values);
    const parsedSystem = parseSystemValues(systemValuesRef.current);
    const specificationChanged = parsedSystem !== undefined && (parsedSystem.lowerSpecLimit !== input.baselineSystem?.lowerSpecLimit || parsedSystem.upperSpecLimit !== input.baselineSystem?.upperSpecLimit);
    if (Object.keys(patch).length === 0 && !specificationChanged) return;
    if (specificationChanged || lastValidDraftRef.current.factorOverrides !== undefined || lastValidDraftRef.current.systemSpecification !== undefined) {
      await input.onSave({
        draftId: draftIdFor(factor.worksheetName, input.inputRevision),
        worksheetName: factor.worksheetName,
        inputRevision: input.inputRevision,
        factorOverrides: createFactorOverrides(input.factors, statesRef.current),
        ...(specificationChanged && parsedSystem !== undefined ? { systemSpecification: parsedSystem } : {}),
        ...(lastValidDraftRef.current.factorOverrides?.some((override) => override.nominalValue !== undefined) ? { signedDirectionEvidence: true } : {}),
      });
      return;
    }
    await input.onSave({ draftId: draftIdFor(factor.worksheetName, input.inputRevision), worksheetName: factor.worksheetName, tableId: factor.tableId, sourceRow: factor.sourceRow, inputRevision: input.inputRevision, patch, ...(patch.nominalValue === undefined ? {} : { signedDirectionEvidence: true }) });
  };

  const editSystem = (field: "lowerSpecLimit" | "upperSpecLimit", value: string) => previewSystemSpecification(field, value);
  const commitSystem = () => {
    const key = input.factors[0]?.key;
    if (key !== undefined) void commitSystemSpecification("upperSpecLimit");
  };

  const previewSystemSpecification = (field: "lowerSpecLimit" | "upperSpecLimit", value: string) => {
    const nextSystemValues = { ...systemValuesRef.current, [field]: value };
    systemValuesRef.current = nextSystemValues;
    setSystemValues(nextSystemValues);
    setSystemSpecificationError(undefined);
    clearWorksheetTimer();
    if (parseSystemValues(nextSystemValues) === undefined) return;
    const key = input.factors[0]?.key;
    if (key !== undefined) timers.current.set("worksheet", window.setTimeout(() => { void calculate(key, { mode: "system" }); }, 300));
  };

  const commitSystemSpecification = async (activeField: "lowerSpecLimit" | "upperSpecLimit") => {
    clearWorksheetTimer();
    const parsed = parseSystemValues(systemValuesRef.current);
    if (parsed === undefined) {
      setSystemSpecificationError("Enter a valid numeric value");
      return;
    }
    const clamped = clampSpecDraft({ ...parsed, activeField });
    const nextSystemValues = { lowerSpecLimit: String(clamped.lowerSpecLimit), upperSpecLimit: String(clamped.upperSpecLimit) };
    systemValuesRef.current = nextSystemValues;
    setSystemValues(nextSystemValues);
    setSystemSpecificationError(clamped.reason);
    const key = input.factors[0]?.key;
    if (key !== undefined) await calculate(key, { mode: "system", systemSpecification: { lowerSpecLimit: clamped.lowerSpecLimit, upperSpecLimit: clamped.upperSpecLimit } });
  };

  return {
    factorStates: states,
    systemValues,
    scenarioResult,
    systemSpecificationError,
    editSystem,
    commitSystem,
    previewSystemSpecification,
    commitSystemSpecification,
    edit,
    commit,
    undo,
    reset,
    save,
    canUndo: history.current.length > 0,
    dirty: [...states.values()].some((state) => state.dirty) || systemDirty(systemValuesRef.current, input.baselineSystem),
  };

  function setFactorError(factorKey: string, error: string) {
    updateStates((current) => updateState(current, factorKey, (candidate) => ({ ...candidate, calculating: false, error })));
  }

  function clearWorksheetTimer() {
    const oldTimer = timers.current.get("worksheet");
    if (oldTimer !== undefined) window.clearTimeout(oldTimer);
    timers.current.delete("worksheet");
  }

  function scheduleWorksheetPreview(factorKey: string) {
    clearWorksheetTimer();
    timers.current.set("worksheet", window.setTimeout(() => { void calculate(factorKey); }, 300));
  }

  function draftIdFor(factorKey: string, inputRevision: number): string {
    const identity = `${inputRevision}:${factorKey}`;
    const existing = draftIds.current.get(identity);
    if (existing !== undefined) return existing;
    const created = globalThis.crypto.randomUUID();
    draftIds.current.set(identity, created);
    return created;
  }
}

function createStates(factors: readonly FactorRowModel[], draft?: F8ScenarioDraft): ReadonlyMap<string, FactorScenarioState> {
  const overrides = new Map((draft?.factorOverrides ?? []).map((override) => [`${override.worksheetName}\u0000${override.tableId}\u0000${override.sourceRow}`, override]));
  const results = new Map((draft?.factorResults ?? []).map((result) => [`${result.worksheetName}\u0000${result.tableId}\u0000${result.sourceRow}`, result]));
  const scenarioResult = scenarioResultFor(draft);
  return new Map(factors.map((factor) => {
    const override = overrides.get(factor.key);
    const result = results.get(factor.key);
    return [factor.key, {
      ...stateFor(factor),
      values: {
        nominalValue: String(override?.nominalValue ?? factor.nominalValue),
        upperTolerance: String(override?.upperTolerance ?? factor.upperTolerance),
        lowerTolerance: String(override?.lowerTolerance ?? factor.lowerTolerance),
        additionalMeanShift: String(draft?.systemSpecification?.additionalMeanShift ?? factor.additionalMeanShift),
      },
      dirty: override !== undefined || draft?.systemSpecification !== undefined,
      ...(scenarioResult === undefined ? {} : { lastValidResult: scenarioResult }),
      ...(result === undefined ? {} : { calculated: result }),
    } satisfies FactorScenarioState];
  }));
}

function stateFor(factor: FactorRowModel): FactorScenarioState {
  return { values: { nominalValue: String(factor.nominalValue), upperTolerance: String(factor.upperTolerance), lowerTolerance: String(factor.lowerTolerance), additionalMeanShift: String(factor.additionalMeanShift) }, dirty: false, calculating: false };
}

function updateState(states: ReadonlyMap<string, FactorScenarioState>, key: string, update: (state: FactorScenarioState) => FactorScenarioState) {
  const state = states.get(key);
  if (state === undefined) return states;
  const next = new Map(states);
  next.set(key, update(state));
  return next;
}

function parseValues(values: FactorScenarioState["values"]): WhatIfValues | undefined {
  const parsed = { nominalValue: Number(values.nominalValue), upperTolerance: Number(values.upperTolerance), lowerTolerance: Number(values.lowerTolerance), additionalMeanShift: Number(values.additionalMeanShift) };
  return Object.values(values).every((value) => value.trim().length > 0) && Object.values(parsed).every(Number.isFinite) && parsed.upperTolerance > parsed.lowerTolerance ? parsed : undefined;
}

function createPatch(factor: FactorRowModel, values: WhatIfValues): NonNullable<F8ScenarioDraft["change"]> {
  const patch: NonNullable<F8ScenarioDraft["change"]> = {};
  if (values.nominalValue !== factor.nominalValue) patch.nominalValue = values.nominalValue;
  if (values.upperTolerance !== factor.upperTolerance) patch.upperTolerance = values.upperTolerance;
  if (values.lowerTolerance !== factor.lowerTolerance) patch.lowerTolerance = values.lowerTolerance;
  if (values.additionalMeanShift !== factor.additionalMeanShift) patch.additionalMeanShift = values.additionalMeanShift;
  return patch;
}

function createFactorOverrides(factors: readonly FactorRowModel[], states: ReadonlyMap<string, FactorScenarioState>): NonNullable<F8ScenarioDraft["factorOverrides"]> {
  return factors.flatMap((factor) => {
    const values = states.get(factor.key)?.values;
    const parsed = values === undefined ? undefined : parseValues(values);
    if (parsed === undefined) return [];
    const { additionalMeanShift: _additionalMeanShift, ...patch } = createPatch(factor, parsed);
    return Object.keys(patch).length === 0 ? [] : [{ worksheetName: factor.worksheetName, tableId: factor.tableId, sourceRow: factor.sourceRow, ...patch }];
  });
}

function scenarioResultFor(draft: F8ScenarioDraft | undefined): WhatIfCalculationResult | undefined {
  return draft?.calculationReference === undefined || draft.calculationMetrics === undefined
    ? undefined
    : { status: "completed", calculationReference: draft.calculationReference, metrics: draft.calculationMetrics };
}

function systemValuesFor(baselineSystem: { readonly lowerSpecLimit?: number; readonly upperSpecLimit?: number } | undefined, draft: F8ScenarioDraft | undefined): { readonly lowerSpecLimit: string; readonly upperSpecLimit: string } {
  return {
    lowerSpecLimit: String(draft?.systemSpecification?.lowerSpecLimit ?? baselineSystem?.lowerSpecLimit ?? ""),
    upperSpecLimit: String(draft?.systemSpecification?.upperSpecLimit ?? baselineSystem?.upperSpecLimit ?? ""),
  };
}

function parseSystemValues(values: { readonly lowerSpecLimit: string; readonly upperSpecLimit: string }): { readonly lowerSpecLimit: number; readonly upperSpecLimit: number } | undefined {
  if (values.lowerSpecLimit.trim().length === 0 || values.upperSpecLimit.trim().length === 0) return undefined;
  const lowerSpecLimit = Number(values.lowerSpecLimit);
  const upperSpecLimit = Number(values.upperSpecLimit);
  return Number.isFinite(lowerSpecLimit) && Number.isFinite(upperSpecLimit) ? { lowerSpecLimit, upperSpecLimit } : undefined;
}

function systemDirty(current: { readonly lowerSpecLimit: string; readonly upperSpecLimit: string }, baseline: { readonly lowerSpecLimit?: number; readonly upperSpecLimit?: number } | undefined): boolean {
  return current.lowerSpecLimit !== String(baseline?.lowerSpecLimit ?? "") || current.upperSpecLimit !== String(baseline?.upperSpecLimit ?? "");
}
