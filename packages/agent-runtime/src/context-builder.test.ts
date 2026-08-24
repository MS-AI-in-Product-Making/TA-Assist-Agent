import { describe, expect, it } from "vitest";

import { buildAgentContext } from "./context-builder.js";

describe("buildAgentContext", () => {
  it("builds a sanitized context from snapshot and turns", () => {
    const context = buildAgentContext({
      snapshot: baseSnapshot({ state: "analysis_context_decision_required" }),
      turns: [
        turn(1, "user", [{ kind: "text", text: "请解释 blocker" }]),
        turn(2, "assistant", [{ kind: "markdown", markdown: "已分析" }]),
      ],
    });

    expect(context.session.state).toBe("analysis_context_decision_required");
    expect(context.session.pendingActions.map((action) => action.action)).toEqual(["confirm_analysis_context"]);
    expect(context.turns).toHaveLength(2);
    expect(context.turns[0]).toMatchObject({ role: "user", text: "请解释 blocker" });
  });

  it("reports F7 as unavailable without surfacing executable commands", () => {
    const context = buildAgentContext({
      snapshot: baseSnapshot({ state: "review_required" }),
      turns: [],
    });

    expect(context.session.f7.status).toBe("feature_not_available");
    expect(context.session.f7.actions).toEqual([]);
  });
});

function baseSnapshot(overrides = {}) {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: "session-task-8",
    revision: 3,
    inputRevision: 1,
    state: "created",
    activeAttempt: null,
    priorRunReferences: [],
    ...overrides,
  };
}

function turn(sequence: number, role: "user" | "assistant" | "tool", content: unknown[]) {
  return {
    contractVersion: "ta-conversation-turn-v1",
    turnId: `turn-${sequence}`,
    sessionId: "session-task-8",
    sequence,
    source: "web",
    role,
    content,
    createdAt: new Date(Date.UTC(2026, 7, 25, 0, 0, sequence)).toISOString(),
    relatedArtifactIds: [],
  };
}