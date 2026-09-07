import type { F8AdoProjection, F8AdoWriteConfirmation } from "@ai-assist/contracts";
import { inputMetadata, type UiCatalogLanguage } from "@ai-assist/product-language/input-metadata";
import { useState } from "react";
import { InputGuidance, inputGuidanceId } from "./InputGuidance.js";

const PROJECTION_STATES_WITH_CONFIRMATION = ["preview_ready", "write_pending", "write_outcome_unknown", "completed"] as const;
type ProjectionStateWithConfirmation = (typeof PROJECTION_STATES_WITH_CONFIRMATION)[number];

interface AdoWorkspaceDecisionProps {
  readonly visible: boolean;
  readonly projection?: F8AdoProjection;
  readonly onSubmit: (decision: "local_only" | "create_new" | "use_existing", workItemReference?: string) => Promise<void>;
  readonly onConfirm?: (confirmation: F8AdoWriteConfirmation) => Promise<void>;
  readonly onReconcile?: () => Promise<void>;
  readonly onReset?: () => Promise<void>;
  readonly onStartNewWriteGeneration?: () => Promise<void>;
  readonly language?: UiCatalogLanguage;
}

export function AdoWorkspaceDecision({ visible, projection, onSubmit, onConfirm, onReconcile, onReset, onStartNewWriteGeneration, language = "en" }: AdoWorkspaceDecisionProps) {
  const [reference, setReference] = useState("");
  const metadata = inputMetadata(language).existing_work_item;
  const copy = language === "zh" ? {
    target: "ADO 目标",
    heading: "治理写入决策",
    description: "选择将此受治理的图纸治理提醒保留在本地，或通过 VS Code Surface MCP host 进行 Azure DevOps 校验。",
    local: "仅本地分析",
    create: "创建工作项",
    validate: "校验已有工作项",
    waitingValidation: "正在等待 VS Code Surface MCP host 校验目标并生成预览...",
    returnToSelection: "返回 ADO 目标选择",
    workItem: "工作项", owner: "负责人", version: "版本", factors: "Factors",
    fullPreview: "完整治理预览", diff: "差异", confirm: "确认 ADO 写入",
    writePending: "Web 端已授权。正在等待 Surface MCP 写入并校验回读...",
    outcomeUnknown: "写入结果未知。开始新的显式写入流程前，请使用 VS Code Surface MCP 回读协调确认评论是否已写入。",
    reconcile: "运行回读协调",
    absent: "回读未找到已确认的预览标记。请准备新的校验预览，并在 Web 端确认后再执行写入。",
    prepare: "准备新的校验预览",
    completed: "ADO 写入已校验",
  } : {
    target: "ADO target",
    heading: "Governance write decision",
    description: "Choose whether this governed drawing-governance reminder stays local or moves through the VS Code Surface MCP host for Azure DevOps validation.",
    local: "Local analysis only",
    create: "Create work item",
    validate: "Validate existing work item",
    waitingValidation: "Waiting for the VS Code Surface MCP host to validate the target and generate a preview...",
    returnToSelection: "Return to ADO target selection",
    workItem: "Work Item", owner: "Owner", version: "Version", factors: "Factors",
    fullPreview: "Full governance preview", diff: "Diff", confirm: "Confirm ADO write",
    writePending: "Authorized in the Web surface. Waiting for the Surface MCP to write and verify the readback...",
    outcomeUnknown: "The write outcome is unknown. Use the VS Code Surface MCP readback reconciliation to confirm whether the comment already landed before starting a new explicit write flow.",
    reconcile: "Run readback reconciliation",
    absent: "Readback did not find the confirmed preview marker. Prepare a new validated preview, then confirm in Web before any write.",
    prepare: "Prepare a new validated preview",
    completed: "ADO write verified",
  };
  if (!visible) return null;
  const confirmation = projection !== undefined && isProjectionStateWithConfirmation(projection.state)
    ? projection.confirmation
    : undefined;
  const previewTarget = projection?.state === "preview_ready" ? projection.target : undefined;
  const previewContentHash = projection?.state === "preview_ready" ? projection.contentHash : undefined;
  return (
    <div className="ado-workspace">
      <div><span>{copy.target}</span><h3>{copy.heading}</h3></div>
      {projection === undefined || projection.state === "not_required" ? (
        <div className="ado-workspace__selection">
          <p>{copy.description}</p>
          <div className="ado-workspace__actions">
            <button type="button" className="button" onClick={() => { void onSubmit("local_only"); }}>{copy.local}</button>
            <button type="button" className="button" onClick={() => { void onSubmit("create_new"); }}>{copy.create}</button>
            <label>{metadata.title}<input aria-label={metadata.title} aria-describedby={inputGuidanceId("existing_work_item")} data-user-input-id="existing_work_item" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="https://dev.azure.com/org/project/_workitems/edit/123" /></label>
            <InputGuidance inputId="existing_work_item" language={language} />
            <button type="button" className="button" disabled={!isAdoWorkItemUrl(reference)} onClick={() => { void onSubmit("use_existing", reference.trim()); }}>{copy.validate}</button>
          </div>
        </div>
      ) : null}
      {projection?.state === "validation_pending" ? <div><p role="status">{copy.waitingValidation}</p><button type="button" className="button" onClick={() => { void onReset?.(); }}>{copy.returnToSelection}</button></div> : null}
      {confirmation === undefined ? null : (
        <div className="ado-workspace__preview">
          <dl><div><dt>{copy.workItem}</dt><dd>{confirmation.workItemReference}</dd></div><div><dt>{copy.owner}</dt><dd>{confirmation.ownerReference}</dd></div><div><dt>{copy.version}</dt><dd>{confirmation.expectedVersion}</dd></div><div><dt>{copy.factors}</dt><dd>{confirmation.factorCount}</dd></div></dl>
          <h3>{copy.fullPreview}</h3><pre>{confirmation.nextContent}</pre>
          <h3>{copy.diff}</h3><div className="ado-workspace__diff">{confirmation.diff.map((entry, index) => <div key={index}><del>{entry.before ?? ""}</del><ins>{entry.after ?? ""}</ins></div>)}</div>
          {projection?.state === "preview_ready" && previewTarget !== undefined && previewContentHash !== undefined ? <button type="button" className="button button--primary" onClick={() => { void onConfirm?.({ contractVersion: "f8-ado-write-confirmation-v1", validationActionId: projection.actionId, expectedRevision: projection.expectedRevision, target: previewTarget, contentHash: previewContentHash, confirmationHash: confirmation.confirmationHash, confirmed: true }); }}>{copy.confirm}</button> : null}
        </div>
      )}
      {projection?.state === "write_pending" ? <p role="status">{copy.writePending}</p> : null}
      {projection?.state === "write_outcome_unknown" ? <div><p role="status">{copy.outcomeUnknown}</p><button type="button" className="button" onClick={() => { void onReconcile?.(); }}>{copy.reconcile}</button></div> : null}
      {projection?.state === "reconciled_absent" ? (
        <div>
          <p role="status">{copy.absent}</p>
          <button type="button" className="button" disabled={onStartNewWriteGeneration === undefined} onClick={() => { void onStartNewWriteGeneration?.(); }}>{copy.prepare}</button>
        </div>
      ) : null}
      {projection?.state === "completed" ? <p role="status">{copy.completed}: {projection.receipt.workItemReference} · {copy.version} {projection.receipt.version}</p> : null}
      {projection?.state === "blocked" || projection?.state === "failed" ? <p role="alert">{projection.reason}</p> : null}
    </div>
  );
}

function isProjectionStateWithConfirmation(state: F8AdoProjection["state"]): state is ProjectionStateWithConfirmation {
  return (PROJECTION_STATES_WITH_CONFIRMATION as readonly string[]).includes(state);
}

function isAdoWorkItemUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && /\/_workitems\/edit\/\d+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}
