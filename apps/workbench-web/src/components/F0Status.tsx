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
          <h2 id="f0-title">F0 到 F6 状态</h2>
        </div>
        <span className={`status-pill ${connected ? "status-pill--ready" : "status-pill--blocked"}`}>{connected ? "SSE 已连接" : "SSE 重连中"}</span>
      </div>
      <p className="support-text">当前 session state: {stateLabel}</p>
      <ol className="ledger-list">
        {entries.map((entry) => (
          <li key={entry.featureId} className="ledger-item">
            <span className="ledger-item__feature">{entry.featureId}</span>
            <span className="ledger-item__status">{entry.status}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
