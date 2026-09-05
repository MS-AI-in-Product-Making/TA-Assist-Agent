import type { ConversationTurn } from "@ai-assist/conversation";
import { useState } from "react";

import type { WorkbenchApi } from "../api.js";
import { ConversationPane } from "./ConversationPane.js";

export interface RequestContextChip {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly included: boolean;
  readonly detail: string;
}

export function TaAssistantPanel({ worksheetName, factorName, turns, disabled, onSubmit }: {
  readonly worksheetName?: string;
  readonly factorName?: string;
  readonly turns: readonly ConversationTurn[];
  readonly api?: WorkbenchApi;
  readonly sessionId?: string;
  readonly disabled: boolean;
  readonly onSubmit: (message: string) => Promise<void>;
  readonly requestContextChips?: readonly RequestContextChip[];
}) {
  const [suggestedMessage, setSuggestedMessage] = useState<string>();
  const contextChips = arguments[0].requestContextChips ?? [];
  const { api, sessionId } = arguments[0];
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
      <ConversationPane turns={turns} api={api} sessionId={sessionId} disabled={disabled} suggestedMessage={suggestedMessage} onSubmit={onSubmit} />
    </section>
  );
}
