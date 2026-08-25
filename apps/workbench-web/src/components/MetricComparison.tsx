export interface WhatIfMetrics {
  readonly mean: number;
  readonly rssSigma: number;
  readonly cp: number;
  readonly cpkL: number;
  readonly cpkU: number;
  readonly cpk: number;
  readonly statisticalMargin: number;
  readonly worstCaseMargin: number;
}

export function MetricComparison({ baseline, draft }: { readonly baseline: WhatIfMetrics; readonly draft?: WhatIfMetrics }) {
  const metrics: readonly [string, keyof WhatIfMetrics][] = [
    ["Mean", "mean"],
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
            <td>{baseline[key].toFixed(3)}</td>
            <td data-testid={key === "cpk" ? "draft-cpk" : undefined}>{draft === undefined ? "-" : draft[key].toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
