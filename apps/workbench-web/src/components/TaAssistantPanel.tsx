import type { ConversationTurn } from "@ai-assist/conversation";
import type { UiCatalogLanguage } from "@ai-assist/product-language";
import { useState } from "react";

import type { WorkbenchApi } from "../api.js";
import type { F8SessionSnapshot } from "../workbench-session.js";
import { ConversationPane } from "./ConversationPane.js";
import { F6InputGate } from "./F6InputGate.js";

export interface RequestContextChip {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly included: boolean;
  readonly detail: string;
}

export function TaAssistantPanel({ worksheetName, factorName, turns, api, sessionId, disabled, onSubmit }: {
  readonly worksheetName?: string;
  readonly factorName?: string;
  readonly turns: readonly ConversationTurn[];
  readonly api?: WorkbenchApi;
  readonly sessionId?: string;
  readonly snapshot?: F8SessionSnapshot;
  readonly language?: UiCatalogLanguage;
  readonly disabled: boolean;
  readonly onSubmit: (message: string) => Promise<void>;
  readonly onSubmitCommand?: (command: "confirm_analysis_context" | "confirm_optimization_targets", payload: Record<string, unknown>) => Promise<void>;
  readonly requestContextChips?: readonly RequestContextChip[];
}) {
  const [suggestedMessage, setSuggestedMessage] = useState<string>();
  const contextChips = arguments[0].requestContextChips ?? [];
  const language = arguments[0].language ?? "en";
  const suggestedPrompts = language === "zh" ? [
    "总结当前受治理的证据",
    "哪个 Factor 是当前风险的主要驱动项？",
    "比较 baseline 与已保存的 Scenario",
  ] : [
    "Summarize the current governed evidence",
    "Which factor is driving the current risk?",
    "Compare the baseline and saved Scenario",
  ];
  const copy = language === "zh"
    ? { current: "当前上下文", waiting: "等待工作区", next: "下一请求上下文", suggested: "建议问题" }
    : { current: "Current context", waiting: "Waiting for workspace", next: "Next request context", suggested: "Suggested prompts" };
  return (
    <section className="ta-assistant" aria-label="TA Assistant">
      <div className="assistant-context">
        <div className="assistant-context__current">
          <span>{copy.current}</span>
          <strong>{worksheetName ?? copy.waiting}</strong>
          {factorName === undefined ? null : <span>{factorName}</span>}
        </div>
        <div className="assistant-context__next">
          <span>{copy.next}</span>
          <div className="token-row" aria-label={copy.next}>
            {contextChips.map((chip) => (
              <span
                key={chip.key}
                className={`token-chip assistant-context-chip ${chip.included ? "assistant-context-chip--included" : "assistant-context-chip--unavailable"}`}
                title={chip.detail}
                aria-label={`${chip.label}: ${chip.value}. ${chip.detail}`}
              >
                {`${chip.label}: ${chip.value}`}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="suggested-prompts" aria-label={copy.suggested}>
        {suggestedPrompts.map((prompt) => <button key={prompt} type="button" disabled={disabled} onClick={() => setSuggestedMessage(prompt)}>{prompt}</button>)}
      </div>
      {arguments[0].onSubmitCommand === undefined ? null : (
        <>
          <F6InputGate
            kind="analysis_context"
            snapshot={arguments[0].snapshot}
            api={api}
            sessionId={sessionId}
            disabled={disabled}
            language={arguments[0].language}
            onSendMessage={onSubmit}
            onSubmitDecision={arguments[0].onSubmitCommand}
          />
          <F6InputGate
            kind="optimization_targets"
            snapshot={arguments[0].snapshot}
            api={api}
            sessionId={sessionId}
            disabled={disabled}
            language={arguments[0].language}
            onSendMessage={onSubmit}
            onSubmitDecision={arguments[0].onSubmitCommand}
          />
        </>
      )}
      <ConversationPane turns={turns} api={api} sessionId={sessionId} disabled={disabled} suggestedMessage={suggestedMessage} language={arguments[0].language} onSubmit={onSubmit} />
    </section>
  );
}
