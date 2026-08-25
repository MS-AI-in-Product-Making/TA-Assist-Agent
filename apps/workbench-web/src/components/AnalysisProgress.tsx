import type { FeatureLedgerEntry } from "../workbench-session.js";

export interface AnalysisProgressProps {
  readonly entries: readonly FeatureLedgerEntry[];
}

export function AnalysisProgress({ entries }: AnalysisProgressProps) {
  const progressEntries = entries.filter((entry) => ["F4", "F5", "F6", "F7"].includes(entry.featureId));

  return (
    <section className="panel" aria-labelledby="analysis-progress-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Progress</p>
          <h2 id="analysis-progress-title">F4 - F7 Progress</h2>
        </div>
      </div>
      <ol className="ledger-list">
        {progressEntries.map((entry) => (
          <li key={entry.featureId} className="ledger-item">
            <span className="ledger-item__feature">{entry.featureId}</span>
            <span className="ledger-item__status">{entry.status}</span>
            <span>{entry.lifecycle ?? "governed"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}