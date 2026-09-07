import { useEffect, useRef, useState } from "react";

import type { F2FindingsDecisionProjection } from "@ai-assist/contracts";
import { inputMetadata, type UiCatalogLanguage } from "@ai-assist/product-language/input-metadata";
import { InputGuidance, inputGuidanceId } from "./InputGuidance.js";

export interface F2FindingsDecisionDialogProps {
  readonly projection: F2FindingsDecisionProjection;
  readonly language?: UiCatalogLanguage;
  readonly onContinue: (worksheetNames: string[]) => Promise<void>;
  readonly onReplace: (file: File) => Promise<void>;
  readonly onCancel?: () => void;
}

export function F2FindingsDecisionDialog({ projection, language = "en", onContinue, onReplace, onCancel }: F2FindingsDecisionDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const copy = dialogCopy(language);
  const metadata = inputMetadata(language).missing_item_decision;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    dialogRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onCancel?.();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), summary") ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === dialogRef.current) { event.preventDefault(); first.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const runAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  };

  return (
    <div className="decision-dialog-backdrop">
      <section ref={dialogRef} tabIndex={-1} onKeyDown={handleKeyDown} className="decision-dialog" role="dialog" aria-modal="true" aria-labelledby="f2-findings-title">
        <header className="decision-dialog__header">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 id="f2-findings-title">{copy.title}</h2>
            <p className="support-text">{copy.description}</p>
          </div>
          <div className="decision-dialog__count" aria-label={copy.readyCount(projection.downstreamReadyWorksheetNames.length)}>
            <strong>{projection.downstreamReadyWorksheetNames.length}</strong>
            <span>{copy.ready}</span>
          </div>
        </header>

        <InputGuidance inputId="missing_item_decision" language={language} />
        <div className="findings-ledger" aria-label={metadata.title}>
          {projection.worksheetFindings.map((finding) => {
            const blocked = finding.readiness === "blocked";
            const messages = [
              ...finding.identifierWarnings.map((code) => warningLabel(code, language)),
              ...finding.blockers.map((code) => blockerLabel(code, language)),
            ];
            return (
              <article key={finding.worksheetName} className={`finding-row finding-row--${blocked ? "blocked" : "ready"}`} role="group" aria-label={finding.worksheetName}>
                <div className="finding-row__heading">
                  <div>
                    <h3>{finding.worksheetName}</h3>
                    <span className="finding-row__status">{blocked ? copy.blocked : copy.ready}</span>
                  </div>
                  <p>{blocked ? copy.blockedConsequence : copy.readyConsequence}</p>
                </div>
                <ul className="finding-row__messages">
                  {messages.length === 0 ? <li>{copy.noGaps}</li> : messages.map((message) => <li key={message}>{message}</li>)}
                </ul>
                <div className="finding-row__guidance">
                  <p><strong>{copy.nextStep}</strong> {blocked ? copy.blockedNext : copy.readyNext}</p>
                  <p><strong>{copy.recovery}</strong> {blocked ? copy.blockedRecovery : copy.readyRecovery}</p>
                </div>
                {finding.sourceRows.length === 0 ? null : (
                  <details className="finding-row__evidence">
                    <summary>{copy.evidence}</summary>
                    <p>{copy.rows(finding.sourceRows)}</p>
                  </details>
                )}
              </article>
            );
          })}
        </div>

        <InputGuidance inputId="workbook_file" language={language} />
        <footer className="decision-dialog__actions">
          <button type="button" className="button button--ghost" disabled={busy} onClick={onCancel}>{copy.cancel}</button>
          <label className="button decision-dialog__replace" aria-disabled={busy}>
            {copy.replace}
            <input
              type="file"
              disabled={busy}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label={copy.replace}
              aria-describedby={inputGuidanceId("workbook_file")}
              data-user-input-id="workbook_file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) void runAction(() => onReplace(file));
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="button button--primary"
            disabled={busy || projection.downstreamReadyWorksheetNames.length === 0}
            onClick={() => void runAction(() => onContinue([...projection.downstreamReadyWorksheetNames]))}
          >
            {copy.continue}
          </button>
        </footer>
      </section>
    </div>
  );
}

function warningLabel(code: string, language: UiCatalogLanguage): string {
  if (code === "drawing_number_missing") return language === "zh" ? "Drawing Number 缺失" : "Drawing Number is missing";
  return language === "zh" ? "DIM ID 缺失" : "DIM ID is missing";
}

function blockerLabel(code: string, language: UiCatalogLanguage): string {
  if (code === "tolerance_path_image_missing") return language === "zh" ? "尺寸链堆叠图缺失" : "Tolerance loop stack-up image is missing";
  if (code.startsWith("required_field_missing:")) {
    const field = code.slice("required_field_missing:".length);
    return language === "zh" ? `必需字段 ${field} 缺失` : `Required field ${field} is missing`;
  }
  if (code.startsWith("system_specification:")) return language === "zh" ? "系统规格证据不完整" : "System specification evidence is incomplete";
  if (code.startsWith("f4_calculability:")) return language === "zh" ? "计算输入无法使用" : "Calculation input is not usable";
  return code;
}

function dialogCopy(language: UiCatalogLanguage) {
  return language === "zh" ? {
    eyebrow: "输入检查",
    title: "检查工作簿发现",
    description: "先确认哪些工作表可继续。标识符缺失是提醒；计算字段或尺寸链堆叠图缺失会阻止对应工作表。",
    ready: "就绪",
    blocked: "已阻止",
    readyCount: (count: number) => `${count} 个工作表就绪`,
    readyConsequence: "该工作表可以继续进入工程分析。",
    blockedConsequence: "该工作表不会进入工程分析。",
    noGaps: "未发现阻止项或标识符提醒。",
    nextStep: "下一步：",
    recovery: "恢复方式：",
    readyNext: "继续后将使用当前受治理的数据。",
    blockedNext: "先在源工作簿中补齐所列内容。",
    readyRecovery: "如来源不正确，请替换工作簿并重新检查。",
    blockedRecovery: "保存修正后的 .xlsx，然后替换当前工作簿。",
    evidence: "证据详情",
    rows: (rows: readonly number[]) => `源行 ${rows.join("、")}`,
    cancel: "取消",
    replace: "替换工作簿",
    continue: "使用就绪工作表继续",
  } : {
    eyebrow: "Input check",
    title: "Review workbook findings",
    description: "Confirm which worksheets can continue. Missing identifiers are warnings; missing calculation fields or a tolerance loop image blocks only that worksheet.",
    ready: "Ready",
    blocked: "Blocked",
    readyCount: (count: number) => `${count} worksheets ready`,
    readyConsequence: "This worksheet can continue into engineering analysis.",
    blockedConsequence: "This worksheet will not enter engineering analysis.",
    noGaps: "No blockers or identifier warnings were found.",
    nextStep: "Next step:",
    recovery: "Recovery:",
    readyNext: "Continue with the current governed data.",
    blockedNext: "Add the listed content in the source workbook first.",
    readyRecovery: "If the source is wrong, replace the workbook and review it again.",
    blockedRecovery: "Save the corrected .xlsx, then replace the current workbook.",
    evidence: "Evidence details",
    rows: (rows: readonly number[]) => `Rows ${rows.join(", ")}`,
    cancel: "Cancel",
    replace: "Replace workbook",
    continue: "Continue with ready worksheets",
  };
}