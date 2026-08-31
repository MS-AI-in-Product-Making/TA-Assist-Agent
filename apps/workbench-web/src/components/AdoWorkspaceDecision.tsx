import type { F8AdoProjection, F8AdoWriteConfirmation } from "@ai-assist/contracts";
import { useState } from "react";

interface AdoWorkspaceDecisionProps {
  readonly visible: boolean;
  readonly projection?: F8AdoProjection;
  readonly onSubmit: (decision: "local_only" | "create_new" | "use_existing", workItemReference?: string) => Promise<void>;
  readonly onConfirm?: (confirmation: F8AdoWriteConfirmation) => Promise<void>;
  readonly onReset?: () => Promise<void>;
}

export function AdoWorkspaceDecision({ visible, projection, onSubmit, onConfirm, onReset }: AdoWorkspaceDecisionProps) {
  const [reference, setReference] = useState("");
  if (!visible) return null;
  const confirmation = projection !== undefined && ["preview_ready", "write_pending", "completed"].includes(projection.state)
    ? projection.confirmation
    : undefined;
  const previewTarget = projection?.state === "preview_ready" ? projection.target : undefined;
  const previewContentHash = projection?.state === "preview_ready" ? projection.contentHash : undefined;
  return (
    <div className="ado-workspace">
      <div><span>ADO target</span><h3>Governance write decision</h3></div>
      {projection === undefined || projection.state === "not_required" ? (
        <div className="ado-workspace__selection">
          <p>Choose whether this governed F3 reminder stays local or moves through the VS Code Surface MCP host for Azure DevOps validation.</p>
          <div className="ado-workspace__actions">
            <button type="button" className="button" onClick={() => { void onSubmit("local_only"); }}>Local analysis only</button>
            <button type="button" className="button" onClick={() => { void onSubmit("create_new"); }}>Create work item</button>
            <label>Existing work item URL<input aria-label="Existing work item URL" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="https://dev.azure.com/org/project/_workitems/edit/123" /></label>
            <button type="button" className="button" disabled={!isAdoWorkItemUrl(reference)} onClick={() => { void onSubmit("use_existing", reference.trim()); }}>Validate existing work item</button>
          </div>
        </div>
      ) : null}
      {projection?.state === "validation_pending" ? <div><p role="status">Waiting for the VS Code Surface MCP host to validate the target and generate a preview...</p><button type="button" className="button" onClick={() => { void onReset?.(); }}>Return to ADO target selection</button></div> : null}
      {confirmation === undefined ? null : (
        <div className="ado-workspace__preview">
          <dl><div><dt>Work Item</dt><dd>{confirmation.workItemReference}</dd></div><div><dt>Owner</dt><dd>{confirmation.ownerReference}</dd></div><div><dt>Version</dt><dd>{confirmation.expectedVersion}</dd></div><div><dt>Factors</dt><dd>{confirmation.factorCount}</dd></div></dl>
          <h3>Full governance preview</h3><pre>{confirmation.nextContent}</pre>
          <h3>Diff</h3><div className="ado-workspace__diff">{confirmation.diff.map((entry, index) => <div key={index}><del>{entry.before ?? ""}</del><ins>{entry.after ?? ""}</ins></div>)}</div>
          {projection?.state === "preview_ready" && previewTarget !== undefined && previewContentHash !== undefined ? <button type="button" className="button button--primary" onClick={() => { void onConfirm?.({ contractVersion: "f8-ado-write-confirmation-v1", validationActionId: projection.actionId, expectedRevision: projection.expectedRevision, target: previewTarget, contentHash: previewContentHash, confirmationHash: confirmation.confirmationHash, confirmed: true }); }}>Confirm ADO write</button> : null}
        </div>
      )}
      {projection?.state === "write_pending" ? <p role="status">Authorized in the Web surface. Waiting for the Surface MCP to write and verify the readback...</p> : null}
      {projection?.state === "completed" ? <p role="status">ADO write verified: {projection.receipt.workItemReference} · Version {projection.receipt.version}</p> : null}
      {projection?.state === "blocked" || projection?.state === "failed" ? <p role="alert">{projection.reason}</p> : null}
    </div>
  );
}

function isAdoWorkItemUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && /\/_workitems\/edit\/\d+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}
