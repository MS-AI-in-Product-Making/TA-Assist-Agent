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
          <p className="eyebrow">F7</p>
          <h2 id="f7-placeholder-title">F7 in development</h2>
        </div>
      </div>
      <p className="support-text">Current status: {status.status}{status.lifecycle === undefined ? "" : ` / ${status.lifecycle}`}</p>
      <p className="support-text">The workspace keeps the F7 slot and downstream handoff boundary, but this version does not provide measured import, preview, or result entry controls.</p>
    </section>
  );
}