import type { FeatureLedgerEntry } from "../workbench-session.js";

export interface F0StatusProps {
  readonly stateLabel: string;
  readonly entries: readonly FeatureLedgerEntry[];
  readonly connected: boolean;
}

export function F0Status({ stateLabel, entries, connected }: F0StatusProps) {
  return (
    <section className="panel" aria-labelledby="f0-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Metrology</p>
          <h2 id="f0-title">Analysis status</h2>
        </div>
        <span className={`status-pill ${connected ? "status-pill--ready" : "status-pill--blocked"}`}>{connected ? "SSE connected" : "Reconnecting"}</span>
      </div>
      <p className="support-text">Current session state: {stateLabel}</p>
      <ol className="ledger-list">
        {entries.map((entry) => (
          <li key={entry.featureId} className="ledger-item">
            <span className="ledger-item__feature">{entry.displayLabel}</span>
            <span className="ledger-item__status">{entry.displayStatus}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
