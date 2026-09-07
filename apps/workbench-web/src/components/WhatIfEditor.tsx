import { useEffect, useRef, useState } from "react";

import { MetricComparison, type WhatIfMetrics } from "./MetricComparison.js";
import { InputGuidance, inputGuidanceId } from "./InputGuidance.js";

export interface WhatIfBaseline {
  readonly worksheetName: string;
  readonly tableId?: string;
  readonly sourceRow?: number;
  readonly factorName: string;
  readonly nominalValue: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly additionalMeanShift: number;
  readonly metrics: WhatIfMetrics;
}

export interface WhatIfValues {
  readonly nominalValue: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly additionalMeanShift: number;
}

export interface WhatIfCalculationResult {
  readonly status: "completed";
  readonly calculationReference: string;
  readonly metrics: WhatIfMetrics;
}

export interface WhatIfEditorApi {
  readonly calculate: (values: WhatIfValues) => Promise<WhatIfCalculationResult>;
  readonly save: (result: WhatIfCalculationResult, values: WhatIfValues) => void | Promise<void>;
}

const fields: readonly [keyof WhatIfValues, string][] = [
  ["nominalValue", "Nominal / Mean"],
  ["upperTolerance", "+Tol"],
  ["lowerTolerance", "-Tol"],
  ["additionalMeanShift", "Additional Mean Shift"],
];

const WHAT_IF_INPUT_IDS = {
  nominalValue: "what_if_nominal_value",
  upperTolerance: "what_if_upper_tolerance",
  lowerTolerance: "what_if_lower_tolerance",
  additionalMeanShift: "what_if_additional_mean_shift",
} as const;

function baselineInputs(baseline: WhatIfBaseline): Record<keyof WhatIfValues, string> {
  return {
    nominalValue: String(baseline.nominalValue),
    upperTolerance: String(baseline.upperTolerance),
    lowerTolerance: String(baseline.lowerTolerance),
    additionalMeanShift: String(baseline.additionalMeanShift),
  };
}

function parseValues(values: Record<keyof WhatIfValues, string>): WhatIfValues | undefined {
  if (Object.values(values).some((value) => value.trim().length === 0)) return undefined;
  const parsed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])) as unknown as WhatIfValues;
  return Object.values(parsed).every(Number.isFinite) ? parsed : undefined;
}

export function WhatIfEditor({ baseline, api, factors, onSelectFactor }: { readonly baseline: WhatIfBaseline; readonly api: WhatIfEditorApi; readonly factors?: readonly WhatIfBaseline[]; readonly onSelectFactor?: (factorKey: string) => void }) {
  const [values, setValues] = useState(() => baselineInputs(baseline));
  const [lastValidResult, setLastValidResult] = useState<WhatIfCalculationResult>();
  const [error, setError] = useState<string>();
  const skipNextDebounce = useRef(false);
  const requestSequence = useRef(0);

  const calculate = async () => {
    const parsed = parseValues(values);
    if (parsed === undefined) {
      setError("Enter a valid numeric value");
      return;
    }
    setError(undefined);
    const requestId = ++requestSequence.current;
    try {
      const result = await api.calculate(parsed);
      if (requestId === requestSequence.current) setLastValidResult(result);
    } catch {
      if (requestId === requestSequence.current) setError("Preview failed. Check the governed baseline and try again.");
    }
  };

  useEffect(() => {
    requestSequence.current += 1;
    setValues(baselineInputs(baseline));
    setLastValidResult(undefined);
    setError(undefined);
  }, [baseline.worksheetName, baseline.tableId, baseline.sourceRow]);

  useEffect(() => {
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return undefined;
    }
    if (JSON.stringify(values) === JSON.stringify(baselineInputs(baseline))) return undefined;
    const timer = window.setTimeout(() => { void calculate(); }, 250);
    return () => window.clearTimeout(timer);
  }, [values]);

  return (
    <section className="panel" aria-labelledby="what-if-title">
      <div className="panel__header"><div><p className="eyebrow">WHAT_IF Draft</p><h2 id="what-if-title">Tolerance preview</h2></div></div>
      {factors !== undefined && factors.length > 1 ? <label>Factor
        <select aria-describedby={inputGuidanceId("what_if_factor")} data-user-input-id="what_if_factor" value={factorKey(baseline)} onChange={(event) => onSelectFactor?.(event.target.value)}>
          {factors.map((factor) => <option key={factorKey(factor)} value={factorKey(factor)}>{factor.factorName}</option>)}
        </select>
      </label> : null}
      {factors !== undefined && factors.length > 1 ? <InputGuidance inputId="what_if_factor" /> : null}
      <div className="form-grid">
        {fields.map(([field, label]) => {
          const inputId = WHAT_IF_INPUT_IDS[field];
          return (
          <label key={field}>{baseline.factorName} {label}
            <input
              aria-describedby={inputGuidanceId(inputId)}
              data-user-input-id={inputId}
              type="number"
              step="any"
              value={values[field]}
              onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  skipNextDebounce.current = true;
                  void calculate();
                }
              }}
            />
          </label>
          );
        })}
      </div>
      <div className="input-guidance-group">{Object.values(WHAT_IF_INPUT_IDS).map((inputId) => <InputGuidance key={inputId} inputId={inputId} />)}</div>
      {error === undefined ? null : <p role="alert">{error}</p>}
      <MetricComparison baseline={baseline.metrics} draft={lastValidResult?.metrics} />
      <div className="button-row">
        <button type="button" className="button" onClick={() => { setValues(baselineInputs(baseline)); setLastValidResult(undefined); setError(undefined); }}>Restore baseline</button>
        <button type="button" className="button button--primary" disabled={lastValidResult === undefined || parseValues(values) === undefined} onClick={() => {
          const parsed = parseValues(values);
          return lastValidResult === undefined || parsed === undefined ? undefined : void api.save(lastValidResult, parsed);
        }}>Save draft</button>
      </div>
    </section>
  );
}

function factorKey(factor: Pick<WhatIfBaseline, "tableId" | "sourceRow">): string {
  return `${factor.tableId ?? ""}\u0000${factor.sourceRow ?? ""}`;
}
