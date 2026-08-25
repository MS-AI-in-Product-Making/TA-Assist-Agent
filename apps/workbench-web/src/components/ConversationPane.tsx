import { useState } from "react";

import type { ConversationTurn } from "@ai-assist/contracts";

export interface ConversationPaneProps {
  readonly turns: readonly ConversationTurn[];
  readonly disabled?: boolean;
  readonly onSubmit: (message: string) => Promise<void>;
}

export function ConversationPane({ turns, disabled = false, onSubmit }: ConversationPaneProps) {
  const [draft, setDraft] = useState("");

  return (
    <section className="panel panel--conversation" aria-labelledby="conversation-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2 id="conversation-title">会话面板</h2>
        </div>
      </div>
      <ol className="conversation-list" aria-live="polite">
        {turns.length === 0 ? <li className="conversation-empty">当前 session 还没有对话记录。</li> : null}
        {turns.map((turn) => (
          <li key={turn.turnId} className={`conversation-item conversation-item--${turn.role}`}>
            <div className="conversation-meta">
              <span>{turn.role === "user" ? "工程师" : turn.role === "assistant" ? "TA Assist" : "Tool"}</span>
              <span>{new Date(turn.createdAt).toLocaleString()}</span>
            </div>
            <div className="conversation-body">
              {turn.content.map((part, index) => {
                if (part.kind === "text") return <p key={`${turn.turnId}-${index}`}>{part.text}</p>;
                if (part.kind === "markdown") return <p key={`${turn.turnId}-${index}`}>{part.markdown}</p>;
                if (part.kind === "error") return <p key={`${turn.turnId}-${index}`}>Error: {part.error.summary}</p>;
                if (part.kind === "decision_reference") return <p key={`${turn.turnId}-${index}`}>Decision: {part.decisionReference}</p>;
                if (part.kind === "artifact_reference") return <p key={`${turn.turnId}-${index}`}>Artifact: {part.label ?? part.artifactId}</p>;
                if (part.kind === "command") return <p key={`${turn.turnId}-${index}`}>Command: {part.command}</p>;
                return <p key={`${turn.turnId}-${index}`}>已生成受控工具动作。</p>;
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
          <span>发送受控消息</span>
          <textarea
            name="conversation"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            disabled={disabled}
          />
        </label>
        <button type="submit" className="button button--primary" disabled={disabled || draft.trim().length === 0}>
          发送消息
        </button>
      </form>
    </section>
  );
}
