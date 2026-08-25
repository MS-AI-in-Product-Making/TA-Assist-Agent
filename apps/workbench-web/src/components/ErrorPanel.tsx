import type { TypedError } from "@ai-assist/contracts";

export interface ErrorPanelProps {
  readonly error?: TypedError;
  readonly onDismiss: () => void;
}

export function ErrorPanel({ error, onDismiss }: ErrorPanelProps) {
  if (error === undefined) {
    return null;
  }

  return (
    <section className="panel panel--error" aria-live="assertive">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Safe error</p>
          <h2>{error.code}</h2>
        </div>
        <button type="button" className="button button--ghost" onClick={onDismiss}>关闭</button>
      </div>
      <p>{error.summary}</p>
      <p className="support-text">{error.suggestedAction}</p>
    </section>
  );
}
