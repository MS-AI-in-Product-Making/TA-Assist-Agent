import { contributionData, specificationModel } from "../chart-model.js";
import type { WorksheetWorkspaceModel } from "../workspace-model.js";
import { SpecificationPlot } from "./SpecificationPlot.js";
import type { WhatIfCalculationResult } from "./WhatIfEditor.js";

interface EngineeringChartsProps {
  readonly worksheet: WorksheetWorkspaceModel;
  readonly scenario?: WhatIfCalculationResult;
  readonly scenarioContributions?: ReadonlyMap<string, number>;
  readonly systemValues?: { readonly lowerSpecLimit: string; readonly upperSpecLimit: string };
  readonly onSystemEdit?: (field: "lowerSpecLimit" | "upperSpecLimit", value: string) => void;
  readonly onSystemCommit?: (field: "lowerSpecLimit" | "upperSpecLimit") => void;
  readonly systemSpecificationError?: string;
}

export function EngineeringCharts({ worksheet, scenario, scenarioContributions, systemValues, onSystemEdit, onSystemCommit, systemSpecificationError }: EngineeringChartsProps) {
  const baseline = worksheet.metrics;
  const draft = scenario?.metrics;
  const contributions = contributionData(worksheet.factors, scenarioContributions);
  const specification = specificationModel(worksheet, draft);
  const meanOffsetSource = baseline === undefined ? undefined : meanOffsetSourceValues(worksheet, baseline);
  const hasScenario = scenario !== undefined;
  const metrics: readonly [string, keyof NonNullable<typeof baseline>][] = [["Mean", "mean"], ["Mean Offset", "meanOffset"], ["RSS", "rssSigma"], ["Cp", "cp"], ["CpkL", "cpkL"], ["CpkU", "cpkU"], ["Cpk", "cpk"], ["Margin", "statisticalMargin"], ["Yield", "yield"], ["DPM", "dpm"]];

  return (
    <section className="engineering-charts" aria-label="Engineering analysis charts">
      {baseline === undefined ? <p>No visual calculation results are available for this worksheet yet.</p> : <div className="metric-strip metric-strip--compact" aria-label="Metric strip">{metrics.map(([label, key]) => metric(label, baseline[key], draft?.[key], label === "Mean Offset" ? meanOffsetSource : undefined))}</div>}
      <div className="chart-grid">
        <figure>
          <figcaption>Factor contribution</figcaption>
          {contributions.length === 0 ? <p>No contribution data is available yet.</p> : (
            <svg role="img" aria-label="Factor contribution" viewBox={`0 0 640 ${Math.max(126, contributions.length * 42 + 36)}`}>
              <g className="chart-legend" aria-label="Contribution legend">
                <g><rect className="baseline-legend__swatch" x="0" y="0" width="12" height="12" fill="#7a807d" /><text x="18" y="10">Baseline</text></g>
                <g transform="translate(120 0)"><rect className="scenario-legend__swatch" x="0" y="0" width="12" height="12" fill={hasScenario ? "#2d6854" : "#9aa7a1"} /><text x="18" y="10">{hasScenario ? "Scenario" : "No scenario"}</text></g>
              </g>
              {contributions.map((datum, index) => <g key={datum.factorKey} transform={`translate(0 ${index * 42 + 28})`}><text x="0" y="22">{datum.label}</text><rect className="baseline-bar" x="190" y="5" width={Math.max(2, datum.baseline * 380)} height="12" fill="#7a807d" />{datum.scenario === undefined ? null : <rect className="scenario-bar" x="190" y="20" width={Math.max(2, datum.scenario * 380)} height="12" fill="#2d6854" />}<text x={200 + Math.max(datum.baseline, datum.scenario ?? 0) * 380} y="28">{hasScenario && datum.scenario !== undefined ? `${(datum.scenario * 100).toFixed(1)}%` : `${(datum.baseline * 100).toFixed(1)}%`}</text></g>)}
            </svg>
          )}
        </figure>
        <figure>
          <figcaption>Specification range and predicted distribution</figcaption>
          {specification === undefined ? <p>Specification or distribution evidence is missing.</p> : <SpecificationPlot model={specification} draft={draft} systemValues={systemValues} onSystemEdit={onSystemEdit} onSystemCommit={onSystemCommit} externalError={systemSpecificationError} />}
        </figure>
      </div>
    </section>
  );
}

function metric(label: string, baseline: number | undefined, scenario: number | undefined, accessibleSource?: string) {
  if (baseline === undefined) return null;
  const delta = scenario === undefined ? undefined : scenario - baseline;
  return <div key={label}><span>{label}</span><strong>{label === "Yield" ? `${(baseline * 100).toFixed(2)}%` : baseline.toFixed(3)}</strong>{delta === undefined ? null : <small className={delta >= 0 ? "metric-delta--positive" : "metric-delta--negative"}>{delta >= 0 ? "+" : ""}{delta.toFixed(3)}</small>}{accessibleSource === undefined ? null : <span className="visually-hidden" aria-label="Mean Offset source values">{accessibleSource}</span>}</div>;
}

function meanOffsetSourceValues(worksheet: WorksheetWorkspaceModel, baseline: NonNullable<WorksheetWorkspaceModel["metrics"]>): string | undefined {
  if (worksheet.analysisTarget.nominal === undefined || baseline.meanOffset === undefined) return undefined;
  return `Calculated Mean ${baseline.mean.toFixed(3)} minus Target Nominal ${worksheet.analysisTarget.nominal.toFixed(3)} equals ${baseline.meanOffset.toFixed(3)}`;
}
