import { useEffect, useState } from "react";

import type { ConversationTurn } from "@ai-assist/conversation";
import { inputMetadata, type UiCatalogLanguage } from "@ai-assist/product-language";

import type { WorkbenchApi } from "../api.js";
import { projectProductText } from "../web-projection.js";
import { InputGuidance, inputGuidanceId } from "./InputGuidance.js";

export interface ConversationPaneProps {
  readonly turns: readonly ConversationTurn[];
  readonly api?: WorkbenchApi;
  readonly sessionId?: string;
  readonly disabled?: boolean;
  readonly suggestedMessage?: string;
  readonly language?: UiCatalogLanguage;
  readonly onSubmit: (message: string) => Promise<void>;
}

export function ConversationPane({ turns, api, sessionId, disabled = false, suggestedMessage, language = "en", onSubmit }: ConversationPaneProps) {
  const metadata = inputMetadata(language).conversation_input;
  const copy = language === "zh" ? {
    eyebrow: "会话", heading: "会话面板", empty: "此会话尚无会话历史。", send: "发送请求",
    engineer: "工程师", assistant: "TA Assist", tool: "工具", pending: "等待模型回答", waiting: "正在等待 VS Code 模型回答...",
    error: "错误", decision: "决策记录可用。", evidence: "证据", command: "受治理的命令可用。", generated: "已生成受治理的工具操作。", report: "设计优化报告",
  } : {
    eyebrow: "Conversation", heading: "Conversation panel", empty: "No conversation history is available for this session yet.", send: "Send request",
    engineer: "Engineer", assistant: "TA Assist", tool: "Tool", pending: "Pending model response", waiting: "Waiting for VS Code model response...",
    error: "Error", decision: "Decision record available.", evidence: "Evidence", command: "Governed command available.", generated: "Generated governed tool action.", report: "Design Optimization Report",
  };
  const [draft, setDraft] = useState("");
  useEffect(() => { if (suggestedMessage !== undefined) setDraft(suggestedMessage); }, [suggestedMessage]);

  return (
    <section className="panel panel--conversation" aria-labelledby="conversation-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="conversation-title">{copy.heading}</h2>
        </div>
      </div>
      <ol className="conversation-list" aria-live="polite">
        {turns.length === 0 ? <li className="conversation-empty">{copy.empty}</li> : null}
        {turns.map((turn) => (
          <li key={turn.turnId} className={`conversation-item conversation-item--${turn.role}`}>
            <div className="conversation-meta">
              <span>{turn.role === "user" ? copy.engineer : turn.role === "assistant" ? copy.assistant : copy.tool}</span>
              {isPendingAssistantTurn(turn) ? <span className="conversation-status">{copy.pending}</span> : null}
              <span>{new Date(turn.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</span>
            </div>
            <div className="conversation-body">
              {turn.content.map((part, index) => {
                if (part.kind === "text") return <p key={`${turn.turnId}-${index}`}>{isPendingAssistantTurn(turn) ? copy.waiting : part.text}</p>;
                if (part.kind === "markdown") return <p key={`${turn.turnId}-${index}`}>{part.markdown}</p>;
                if (part.kind === "error") return <p key={`${turn.turnId}-${index}`}>{copy.error}: {part.error.summary}</p>;
                if (part.kind === "decision_reference") return <p key={`${turn.turnId}-${index}`}>{copy.decision}</p>;
                if (part.kind === "artifact_reference") {
                  const label = projectProductText(part.label ?? part.artifactId, language);
                  if (api !== undefined && sessionId !== undefined) {
                    return <p key={`${turn.turnId}-${index}`}>{copy.evidence}: <a href={api.artifactUrl(sessionId, part.artifactId)}>{label}</a></p>;
                  }
                  return <p key={`${turn.turnId}-${index}`}>{copy.evidence}: {label}</p>;
                }
                if (part.kind === "command") return <p key={`${turn.turnId}-${index}`}>{copy.command}</p>;
                const reportAction = part.actions.find((action) => action.type === "open_report");
                const reportArtifact = selectReportArtifact(turn, language);
                if (reportAction !== undefined && reportArtifact !== undefined && api !== undefined && sessionId !== undefined) {
                  return <p key={`${turn.turnId}-${index}`}><a href={api.artifactUrl(sessionId, reportArtifact.artifactId)} download={reportArtifact.fileName}>{copy.report}</a></p>;
                }
                return <p key={`${turn.turnId}-${index}`}>{copy.generated}</p>;
              })}
            </div>
          </li>
        ))}
      </ol>
      <form
        className="conversation-form"
        onSubmit={(event) => {
          event.preventDefault();
          const message = draft.trim();
          if (message.length === 0) return;
          void onSubmit(message).then(() => setDraft(""));
        }}
      >
        <label className="field">
          <span>{metadata.title}</span>
          <textarea
            name="conversation"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            disabled={disabled}
            aria-label={metadata.title}
            aria-describedby={inputGuidanceId("conversation_input")}
            data-user-input-id="conversation_input"
          />
          <InputGuidance inputId="conversation_input" language={language} />
        </label>
        <button type="submit" className="button button--primary" disabled={disabled || draft.trim().length === 0}>
          {copy.send}
        </button>
      </form>
    </section>
  );
}

function selectReportArtifact(turn: ConversationTurn, language: UiCatalogLanguage): { readonly artifactId: string; readonly fileName: string } | undefined {
  const artifacts = turn.content.filter((part): part is Extract<ConversationTurn["content"][number], { kind: "artifact_reference" }> => part.kind === "artifact_reference");
  const artifact = artifacts.find((candidate) => /report/i.test(candidate.label ?? ""));
  if (artifact === undefined) return undefined;
  const projectedLabel = projectProductText(artifact.label ?? "", language);
  const requestedName = projectedLabel.toLowerCase().endsWith(".md") ? projectedLabel : `${projectProductText("F6", language)}-Report.md`;
  const safeStem = requestedName.slice(0, -3).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\.{2,}/g, "-").replace(/^[-.\s]+|[-.\s]+$/g, "");
  const candidateStem = safeStem.length === 0 ? projectProductText("F6", language) : safeStem;
  const windowsReserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(candidateStem);
  const fileName = `${windowsReserved ? `Report-${candidateStem}` : candidateStem}.md`;
  return { artifactId: artifact.artifactId, fileName };
}

function isPendingAssistantTurn(turn: ConversationTurn): boolean {
  if (turn.role !== "assistant" || turn.source !== "system") return false;
  const textParts = turn.content.filter((part): part is Extract<ConversationTurn["content"][number], { kind: "text" }> => part.kind === "text");
  return textParts.length === 1 && ["等待 VS Code 模型回答…", "Waiting for VS Code model response...", "Waiting for VS Code model response…"].includes(textParts[0]!.text.trim());
}
