import { useEffect, useState } from "react";

import type { ConversationTurn } from "@ai-assist/conversation";

export interface ConversationPaneProps {
  readonly turns: readonly ConversationTurn[];
  readonly disabled?: boolean;
  readonly suggestedMessage?: string;
  readonly onSubmit: (message: string) => Promise<void>;
}

export function ConversationPane({ turns, disabled = false, suggestedMessage, onSubmit }: ConversationPaneProps) {
  const [draft, setDraft] = useState("");
  useEffect(() => { if (suggestedMessage !== undefined) setDraft(suggestedMessage); }, [suggestedMessage]);

  return (
    <section className="panel panel--conversation" aria-labelledby="conversation-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2 id="conversation-title">Conversation panel</h2>
        </div>
      </div>
      <ol className="conversation-list" aria-live="polite">
        {turns.length === 0 ? <li className="conversation-empty">No conversation history is available for this session yet.</li> : null}
        {turns.map((turn) => (
          <li key={turn.turnId} className={`conversation-item conversation-item--${turn.role}`}>
            <div className="conversation-meta">
              <span>{turn.role === "user" ? "Engineer" : turn.role === "assistant" ? "TA Assist" : "Tool"}</span>
              {isPendingAssistantTurn(turn) ? <span className="conversation-status">Pending model response</span> : null}
              <span>{new Date(turn.createdAt).toLocaleString()}</span>
            </div>
            <div className="conversation-body">
              {turn.content.map((part, index) => {
                if (part.kind === "text") return <p key={`${turn.turnId}-${index}`}>{isPendingAssistantTurn(turn) ? "Waiting for VS Code model response..." : part.text}</p>;
                if (part.kind === "markdown") return <p key={`${turn.turnId}-${index}`}>{part.markdown}</p>;
                if (part.kind === "error") return <p key={`${turn.turnId}-${index}`}>Error: {part.error.summary}</p>;
                if (part.kind === "decision_reference") return <p key={`${turn.turnId}-${index}`}>Decision record: {part.decisionReference}</p>;
                if (part.kind === "artifact_reference") return <p key={`${turn.turnId}-${index}`}>Evidence: {part.label ?? part.artifactId}</p>;
                if (part.kind === "command") return <p key={`${turn.turnId}-${index}`}>Command: {part.command}</p>;
                return <p key={`${turn.turnId}-${index}`}>Generated governed tool action.</p>;
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
          <span>Ask TA Assist from governed evidence</span>
          <textarea
            name="conversation"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            disabled={disabled}
          />
        </label>
        <button type="submit" className="button button--primary" disabled={disabled || draft.trim().length === 0}>
          Send message
        </button>
      </form>
    </section>
  );
}

function isPendingAssistantTurn(turn: ConversationTurn): boolean {
  if (turn.role !== "assistant" || turn.source !== "system") return false;
  const textParts = turn.content.filter((part): part is Extract<ConversationTurn["content"][number], { kind: "text" }> => part.kind === "text");
  return textParts.length === 1 && ["等待 VS Code 模型回答…", "Waiting for VS Code model response...", "Waiting for VS Code model response…"].includes(textParts[0]!.text.trim());
}
