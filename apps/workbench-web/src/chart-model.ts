import type { FactorRowModel, WorksheetWorkspaceModel } from "./workspace-model.js";
import type { WhatIfMetrics } from "./components/MetricComparison.js";

export interface ContributionDatum { readonly factorKey: string; readonly label: string; readonly baseline: number; readonly scenario?: number; readonly unit: string }
export interface SpecificationPlotModel {
  readonly lsl: number;
  readonly usl: number;
  readonly baselineMean: number;
  readonly baselineLower: number;
  readonly baselineUpper: number;
  readonly scenarioMean?: number;
  readonly baselineSigma: number;
  readonly scenarioSigma?: number;
  readonly scenarioLower?: number;
  readonly scenarioUpper?: number;
  readonly worstCaseLower?: number;
  readonly worstCaseUpper?: number;
}

export function contributionData(factors: readonly FactorRowModel[], scenario?: ReadonlyMap<string, number>): ContributionDatum[] {
  return factors.filter((factor) => factor.contribution !== undefined).map((factor) => ({
    factorKey: factor.key,
    label: factor.factorName.displayText,
    baseline: factor.contribution!,
    scenario: scenario?.get(factor.key),
    unit: factor.unit,
  }));
}

export function specificationModel(worksheet: WorksheetWorkspaceModel, scenario?: WhatIfMetrics): SpecificationPlotModel | undefined {
  const baseline = worksheet.metrics;
  if (baseline === undefined || !Number.isFinite(baseline.rssSigma) || baseline.rssSigma <= 0) return undefined;
  const lsl = baseline.lowerSpecLimit;
  const usl = baseline.upperSpecLimit;
  if (lsl === undefined || usl === undefined) return undefined;
  if (!(usl > lsl)) return undefined;
  const baselineLower = Number.isFinite(baseline.statisticalLower) ? baseline.statisticalLower : baseline.mean - baseline.rssSigma * 3;
  const baselineUpper = Number.isFinite(baseline.statisticalUpper) ? baseline.statisticalUpper : baseline.mean + baseline.rssSigma * 3;
  return {
    lsl,
    usl,
    baselineMean: baseline.mean,
    baselineLower,
    baselineUpper,
    baselineSigma: baseline.rssSigma,
    ...(scenario === undefined
      ? {}
      : {
          scenarioMean: scenario.mean,
          scenarioSigma: scenario.rssSigma,
          scenarioLower: Number.isFinite(scenario.statisticalLower) ? scenario.statisticalLower : scenario.mean - scenario.rssSigma * 3,
          scenarioUpper: Number.isFinite(scenario.statisticalUpper) ? scenario.statisticalUpper : scenario.mean + scenario.rssSigma * 3,
          ...(Number.isFinite(scenario.worstCaseLower) ? { worstCaseLower: scenario.worstCaseLower } : {}),
          ...(Number.isFinite(scenario.worstCaseUpper) ? { worstCaseUpper: scenario.worstCaseUpper } : {}),
        }),
  };
}

export function xPosition(value: number, minimum: number, maximum: number, width: number): number {
  const span = Math.max(Math.abs(maximum - minimum), 1e-9);
  return ((value - minimum) / span) * width;
}
