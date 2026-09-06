import { useEffect, useMemo, useState } from "react";

import type { F8PendingF6InputDraft } from "@ai-assist/contracts";

import type { F6InputDraftReadResult, WorkbenchApi } from "../api.js";
import type { F8SessionSnapshot } from "../workbench-session.js";

type GateKind = "analysis_context" | "optimization_targets";

export interface F6InputGateProps {
  readonly kind: GateKind;
  readonly snapshot?: F8SessionSnapshot;
  readonly api?: WorkbenchApi;
  readonly sessionId?: string;
  readonly disabled?: boolean;
  readonly onSendMessage: (message: string) => Promise<void>;
  readonly onSubmitDecision: (command: "confirm_analysis_context" | "confirm_optimization_targets", payload: Record<string, unknown>) => Promise<void>;
}

export function F6InputGate({ kind, snapshot, api, sessionId, disabled = false, onSendMessage, onSubmitDecision }: F6InputGateProps) {
  const [draft, setDraft] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<F6InputDraftReadResult>();

  const active = kind === "analysis_context"
    ? snapshot?.state === "analysis_context_decision_required"
    : snapshot?.state === "optimization_targets_decision_required";

  const pendingDraft = useMemo<F8PendingF6InputDraft | undefined>(() => {
    if (kind === "analysis_context") return snapshot?.pendingAnalysisContextDraft;
    return snapshot?.pendingOptimizationTargetsDraft;
  }, [kind, snapshot]);

  useEffect(() => {
    let cancelled = false;
    if (!active || pendingDraft === undefined || api === undefined || sessionId === undefined) {
      setPreview(undefined);
      setLoadingPreview(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingPreview(true);
    void api.readF6InputDraft(sessionId, pendingDraft.draftId)
      .then((value) => {
        if (!cancelled) setPreview(value);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, api, pendingDraft, sessionId]);

  if (!active) {
    return null;
  }

  const previewReady = pendingDraft !== undefined && preview?.pendingDraft.draftId === pendingDraft.draftId;
  const clarifications = preview?.materialization.proposal.clarifications ?? [];
  const rows = preview === undefined ? [] : extractPreviewRows(kind, preview.materialization.preview);

  const gateTitle = kind === "analysis_context" ? "补充/确认分析背景" : "补充/确认优化方向";
  const fieldLabel = kind === "analysis_context" ? "补充分析背景" : "补充优化方向";
  const fieldHint = kind === "analysis_context"
    ? "直接描述产品功能、装配关系、工况、功能边界或关注点"
    : "描述希望优先评估 nominal、mean shift、specification 或 tolerance";

  return (
    <section className="panel f6-input-gate" aria-label={gateTitle}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Design Optimization</p>
          <h2>{gateTitle}</h2>
        </div>
      </div>
      <form
        className="conversation-form"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (text.length === 0) return;
          void onSendMessage(text).then(() => setDraft(""));
        }}
      >
        <label className="field">
          <span>{fieldLabel}</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            disabled={disabled}
            placeholder={fieldHint}
          />
        </label>
        <button type="submit" className="button" disabled={disabled || draft.trim().length === 0}>发送补充说明</button>
      </form>
      {loadingPreview ? <p className="support-text">正在准备预览...</p> : null}
      {clarifications.length === 0 ? null : (
        <section aria-label="Clarifications">
          <h3>Clarifications</h3>
          <ul>
            {clarifications.map((item) => <li key={item.clarificationId}>{item.question}</li>)}
          </ul>
        </section>
      )}
      {rows.length === 0 ? null : (
        <section aria-label="Preview">
          <h3>Preview</h3>
          <ul>
            {rows.map((row, index) => (
              <li key={`${row.worksheetName}-${row.factorName ?? "system"}-${index}`}>
                {row.worksheetName} | {row.factorName ?? "System"} | Requirement change: {row.requirementChange} | {row.valueLabel}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="f6-input-gate__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={disabled || !previewReady}
          onClick={() => {
            if (pendingDraft === undefined) return;
            void onSubmitDecision(kind === "analysis_context" ? "confirm_analysis_context" : "confirm_optimization_targets", {
              decision: "confirm",
              draftId: pendingDraft.draftId,
              draftHash: pendingDraft.contentHash,
            });
          }}
        >
          {kind === "analysis_context" ? "确认分析背景" : "确认优化方向"}
        </button>
        <button
          type="button"
          className="button"
          disabled={disabled}
          onClick={() => {
            void onSubmitDecision(kind === "analysis_context" ? "confirm_analysis_context" : "confirm_optimization_targets", { decision: "decline" });
          }}
        >
          拒绝
        </button>
        <button
          type="button"
          className="button"
          disabled={disabled}
          onClick={() => {
            void onSubmitDecision(kind === "analysis_context" ? "confirm_analysis_context" : "confirm_optimization_targets", { decision: "not_provided" });
          }}
        >
          暂不提供
        </button>
      </div>
    </section>
  );
}

interface PreviewRow {
  readonly worksheetName: string;
  readonly factorName?: string;
  readonly requirementChange: string;
  readonly valueLabel: string;
}

function extractPreviewRows(kind: GateKind, preview: unknown): PreviewRow[] {
  if (typeof preview !== "object" || preview === null) return [];
  const artifact = (preview as { artifact?: unknown }).artifact;
  if (typeof artifact !== "object" || artifact === null) return [];
  const worksheets = Array.isArray((artifact as { worksheets?: unknown }).worksheets)
    ? (artifact as { worksheets: unknown[] }).worksheets
    : [];

  if (kind === "analysis_context") {
    return worksheets.flatMap((worksheet) => {
      const worksheetName = readText(worksheet, "worksheetName");
      if (worksheetName === undefined) return [];
      return [{
        worksheetName,
        requirementChange: "Analysis context",
        valueLabel: "Narrative captured",
      }];
    });
  }

  return worksheets.flatMap((worksheet) => {
    const worksheetName = readText(worksheet, "worksheetName");
    const targets = Array.isArray((worksheet as { targets?: unknown }).targets) ? (worksheet as { targets: unknown[] }).targets : [];
    if (worksheetName === undefined || targets.length === 0) return [];
    return targets.flatMap((target) => {
      const requirementChange = readText(target, "targetType") ?? "optimization_target";
      const factor = (target as { factor?: unknown }).factor;
      const factorName = typeof factor === "object" && factor !== null ? readText(factor, "factorName") : undefined;
      const valueLabel = formatValue(target);
      return [{ worksheetName, factorName, requirementChange, valueLabel }];
    });
  });
}

function formatValue(target: unknown): string {
  if (typeof target !== "object" || target === null) return "Not provided";
  const unit = readText(target, "unit") ?? "";
  const lowerTolerance = readNumber(target, "lowerTolerance");
  const upperTolerance = readNumber(target, "upperTolerance");
  if (lowerTolerance !== undefined && upperTolerance !== undefined) return `[${lowerTolerance}, ${upperTolerance}] ${unit}`.trim();

  const nominalValue = readNumber(target, "nominalValue");
  if (nominalValue !== undefined) return `${nominalValue} ${unit}`.trim();

  const lowerSpecLimit = readNumber(target, "lowerSpecLimit");
  const upperSpecLimit = readNumber(target, "upperSpecLimit");
  if (lowerSpecLimit !== undefined || upperSpecLimit !== undefined) {
    return `[${lowerSpecLimit ?? "-"}, ${upperSpecLimit ?? "-"}] ${unit}`.trim();
  }

  const targetMean = readNumber((target as { target?: unknown }).target, "targetMean");
  if (targetMean !== undefined) return `${targetMean} ${unit}`.trim();

  const additionalMeanShift = readNumber((target as { target?: unknown }).target, "resultingAdditionalMeanShift");
  if (additionalMeanShift !== undefined) return `${additionalMeanShift} ${unit}`.trim();

  return "Not provided";
}

function readText(input: unknown, key: string): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(input: unknown, key: string): number | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
