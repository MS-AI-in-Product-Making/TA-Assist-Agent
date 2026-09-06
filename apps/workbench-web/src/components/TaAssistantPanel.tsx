import type { ConversationTurn } from "@ai-assist/conversation";
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
  readonly disabled: boolean;
  readonly onSubmit: (message: string) => Promise<void>;
  readonly onSubmitCommand?: (command: "confirm_analysis_context" | "confirm_optimization_targets", payload: Record<string, unknown>) => Promise<void>;
  readonly requestContextChips?: readonly RequestContextChip[];
}) {
  const [suggestedMessage, setSuggestedMessage] = useState<string>();
  const contextChips = arguments[0].requestContextChips ?? [];
  return (
    <section className="ta-assistant" aria-label="TA Assistant">
      <div className="assistant-context">
        <div className="assistant-context__current">
          <span>Current context</span>
          <strong>{worksheetName ?? "Waiting for workspace"}</strong>
          {factorName === undefined ? null : <span>{factorName}</span>}
        </div>
        <div className="assistant-context__next">
          <span>Next request context</span>
          <div className="token-row" aria-label="Next request context">
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
      <div className="suggested-prompts" aria-label="Suggested prompts">
        {[
          "Summarize the current governed evidence",
          "Which factor is driving the current risk?",
          "Compare the baseline and saved Scenario",
        ].map((prompt) => <button key={prompt} type="button" disabled={disabled} onClick={() => setSuggestedMessage(prompt)}>{prompt}</button>)}
      </div>
      {arguments[0].onSubmitCommand === undefined ? null : (
        <>
          <F6InputGate
            kind="analysis_context"
            snapshot={arguments[0].snapshot}
            api={api}
            sessionId={sessionId}
            disabled={disabled}
            onSendMessage={onSubmit}
            onSubmitDecision={arguments[0].onSubmitCommand}
          />
          <F6InputGate
            kind="optimization_targets"
            snapshot={arguments[0].snapshot}
            api={api}
            sessionId={sessionId}
            disabled={disabled}
            onSendMessage={onSubmit}
            onSubmitDecision={arguments[0].onSubmitCommand}
          />
        </>
      )}
      <ConversationPane turns={turns} api={api} sessionId={sessionId} disabled={disabled} suggestedMessage={suggestedMessage} onSubmit={onSubmit} />
    </section>
  );
}
