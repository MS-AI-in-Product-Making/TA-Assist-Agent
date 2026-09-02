export interface F7PlaceholderProps {
  readonly status: {
    readonly status: string;
    readonly lifecycle?: string;
  };
}

export function F7Placeholder({ status }: F7PlaceholderProps) {
  return (
    <section className="panel" aria-labelledby="f7-placeholder-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Measured feedback</p>
          <h2 id="f7-placeholder-title">Measured feedback import unavailable</h2>
        </div>
      </div>
      <p className="support-text">Current status: {status.status}{status.lifecycle === undefined ? "" : ` / ${status.lifecycle}`}</p>
      <p className="support-text">This release keeps the downstream handoff boundary but does not provide measured import, preview, or result entry controls yet.</p>
    </section>
  );
}