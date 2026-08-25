import { useState } from "react";

export interface AdoDecisionProps {
  readonly visible: boolean;
  readonly disabled?: boolean;
  readonly onSubmit: (decision: "create_new" | "use_existing" | "local_only", rationale: string, workItemReference?: string) => Promise<void>;
}

export function AdoDecision({ visible, disabled = false, onSubmit }: AdoDecisionProps) {
  const [decision, setDecision] = useState<"create_new" | "use_existing" | "local_only">("local_only");
  const [rationale, setRationale] = useState("");
  const [workItemReference, setWorkItemReference] = useState("");

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
          void onSubmit(decision, rationale.trim(), decision === "use_existing" ? workItemReference.trim() : undefined);
        }}
      >
        <fieldset className="choice-group" disabled={disabled}>
          <legend>仅在 `governance_required` 时出现</legend>
          <label>
            <input type="radio" name="ado-decision" checked={decision === "create_new"} onChange={() => setDecision("create_new")} />
            创建新的 ADO work item
          </label>
          <label>
            <input type="radio" name="ado-decision" checked={decision === "use_existing"} onChange={() => setDecision("use_existing")} />
            使用现有 ADO work item
          </label>
          <label>
            <input type="radio" name="ado-decision" checked={decision === "local_only"} onChange={() => setDecision("local_only")} />
            不发布到 ADO
          </label>
        </fieldset>
        {decision === "use_existing" ? <label className="field">
          <span>ADO Work Item reference</span>
          <input value={workItemReference} onChange={(event) => setWorkItemReference(event.target.value)} required disabled={disabled} />
        </label> : null}
        <label className="field">
          <span>决定备注</span>
          <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} disabled={disabled} />
        </label>
        <button type="submit" className="button button--primary" disabled={disabled || (decision === "use_existing" && workItemReference.trim().length === 0)}>确认 ADO 决定</button>
      </form>
    </section>
  );
}
