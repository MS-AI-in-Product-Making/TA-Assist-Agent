export interface WhatIfMetrics {
  readonly mean: number;
  readonly meanOffset?: number;
  readonly rssSigma: number;
  readonly cp: number;
  readonly cpkL: number;
  readonly cpkU: number;
  readonly cpk: number;
  readonly statisticalMargin: number;
  readonly worstCaseMargin: number;
  readonly lowerSpecLimit?: number;
  readonly upperSpecLimit?: number;
  readonly meanShift?: number;
  readonly yield?: number;
  readonly dpm?: number;
  readonly statisticalLower?: number;
  readonly statisticalUpper?: number;
  readonly worstCaseLower?: number;
  readonly worstCaseUpper?: number;
}

export function MetricComparison({ baseline, draft }: { readonly baseline: WhatIfMetrics; readonly draft?: WhatIfMetrics }) {
  const metrics: readonly [string, keyof WhatIfMetrics][] = [
    ["Mean", "mean"],
    ["Mean Offset", "meanOffset"],
    ["RSS 1sigma", "rssSigma"],
    ["Cp", "cp"],
    ["CpkL", "cpkL"],
    ["CpkU", "cpkU"],
    ["Cpk", "cpk"],
    ["Statistical Margin", "statisticalMargin"],
    ["WC Margin", "worstCaseMargin"],
  ];
  return (
    <table className="data-table">
      <thead><tr><th>Metric</th><th>Baseline</th><th>Draft</th></tr></thead>
      <tbody>
        {metrics.map(([label, key]) => (
          <tr key={key}>
            <th scope="row">{label}</th>
            <td>{formatMetricValue(baseline[key])}</td>
            <td data-testid={key === "cpk" ? "draft-cpk" : undefined}>{draft === undefined ? "-" : formatMetricValue(draft[key])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatMetricValue(value: number | undefined): string {
  return value === undefined ? "-" : value.toFixed(3);
}
