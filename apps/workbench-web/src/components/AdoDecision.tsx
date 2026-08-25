import { useState } from "react";

export interface AdoDecisionProps {
  readonly visible: boolean;
  readonly disabled?: boolean;
  readonly onSubmit: (decision: string, rationale: string) => Promise<void>;
}

export function AdoDecision({ visible, disabled = false, onSubmit }: AdoDecisionProps) {
  const [decision, setDecision] = useState("preview_only");
  const [rationale, setRationale] = useState("");

  if (!visible) {
    return null;
  }

  return (
    <section className="panel" aria-labelledby="ado-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">ADO</p>
          <h2 id="ado-title">治理发布决定</h2>
        </div>
      </div>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(decision, rationale.trim());
        }}
      >
        <fieldset className="choice-group" disabled={disabled}>
          <legend>仅在 `governance_required` 时出现</legend>
          <label>
            <input type="radio" name="ado-decision" checked={decision === "preview_only"} onChange={() => setDecision("preview_only")} />
            仅保留预览，不执行写入
          </label>
          <label>
            <input type="radio" name="ado-decision" checked={decision === "confirm_write"} onChange={() => setDecision("confirm_write")} />
            进入受控写入流程
          </label>
        </fieldset>
        <label className="field">
          <span>决定备注</span>
          <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} disabled={disabled} />
        </label>
        <button type="submit" className="button button--primary" disabled={disabled}>确认 ADO 决定</button>
      </form>
    </section>
  );
}
