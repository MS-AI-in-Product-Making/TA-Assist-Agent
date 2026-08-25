import { useState } from "react";

export interface TolerancePromotionChange {
  readonly factorName: string;
  readonly baselineUpperTolerance: number;
  readonly baselineLowerTolerance: number;
  readonly draftUpperTolerance: number;
  readonly draftLowerTolerance: number;
}

export function PromotionPreview({ changes, onConfirm }: {
  readonly changes: readonly TolerancePromotionChange[];
  readonly onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="panel" aria-labelledby="promotion-preview-title">
      <div className="panel__header"><div><p className="eyebrow">Promotion Preview</p><h2 id="promotion-preview-title">Optimization Targets</h2></div></div>
      <table className="data-table">
        <thead><tr><th>Factor</th><th>Lower tolerance</th><th>Upper tolerance</th></tr></thead>
        <tbody>{changes.map((change) => (
          <tr key={change.factorName}>
            <th scope="row">{change.factorName}</th>
            <td>{change.baselineLowerTolerance.toFixed(3)} → {change.draftLowerTolerance.toFixed(3)}</td>
            <td>{change.baselineUpperTolerance.toFixed(3)} → {change.draftUpperTolerance.toFixed(3)}</td>
          </tr>
        ))}</tbody>
      </table>
      <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> 我确认仅提升公差变更</label>
      <button type="button" className="button button--primary" disabled={!confirmed || changes.length === 0} onClick={onConfirm}>确认 Optimization Targets</button>
    </section>
  );
}
