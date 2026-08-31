import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WorkbenchApi } from "./api.js";
import { useWorkbenchSession } from "./use-session.js";

describe("useWorkbenchSession review artifacts", () => {
  it("treats locally computed conversation sequence as non-authoritative", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "web-turn-1" });
    const appended = {
      contractVersion: "ta-conversation-turn-v1" as const,
      turnId: "web-turn-1:assistant",
      sessionId: "session-stale-local",
      sequence: 3,
      source: "system" as const,
      role: "assistant" as const,
      content: [{ kind: "text" as const, text: "Waiting for model." }],
      createdAt: "2026-08-31T00:00:02.000Z",
      relatedArtifactIds: [],
    };
    const api = {
      bootstrap: vi.fn(async () => ({ sessionId: "session-stale-local", snapshot: snapshot("session-stale-local"), conversation: [] })),
      subscribe: vi.fn(() => () => undefined),
      readConversation: vi.fn(async () => []),
      appendConversationTurn: vi.fn(async () => appended),
      loadArtifactJson: vi.fn(),
    } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));
    await waitFor(() => expect(result.current.sessionId).toBe("session-stale-local"));

    await act(async () => {
      await result.current.appendConversation("Explain the current risk.", { worksheetName: "Analysis-A" });
    });

    expect(api.appendConversationTurn).toHaveBeenCalledWith(expect.objectContaining({
      turnId: "web-turn-1",
      sessionId: "session-stale-local",
      sequence: 0,
      content: [{ kind: "text", text: "Explain the current risk." }],
    }), { worksheetName: "Analysis-A" });
    expect(result.current.conversation.at(-1)).toEqual(appended);
  });

  it("loads only the complete current review context", async () => {
    const currentContext = "a".repeat(64);
    const staleContext = "b".repeat(64);
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1" as const,
      sessionId: "session-review",
      revision: 8,
      inputRevision: 4,
      state: "review_required" as const,
      activeAttempt: null,
      priorRunReferences: [],
      artifactRefs: [
        { artifactId: "f4-stale", kind: "f4_calculation", revision: 3, validated: true, reviewContextId: staleContext },
        { artifactId: "f5-stale", kind: "f5_report", revision: 3, validated: true, reviewContextId: staleContext },
        { artifactId: "f6-stale", kind: "f6_report", revision: 3, validated: true, reviewContextId: staleContext },
        { artifactId: "f6-optimization-stale", kind: "f6_optimization", revision: 3, validated: true, reviewContextId: staleContext },
        { artifactId: "f4-current", kind: "f4_calculation", revision: 4, validated: true, reviewContextId: currentContext },
        { artifactId: "f5-current", kind: "f5_report", revision: 4, validated: true, reviewContextId: currentContext },
        { artifactId: "f6-current", kind: "f6_report", revision: 4, validated: true, reviewContextId: currentContext },
        { artifactId: "f6-optimization-current", kind: "f6_optimization", revision: 4, validated: true, reviewContextId: currentContext },
      ],
    };
    const loadArtifactJson = vi.fn(async (_sessionId: string, artifactId: string) => ({ artifactId }));
    const api = {
      bootstrap: vi.fn(async () => ({ sessionId: snapshot.sessionId, snapshot, conversation: [] })),
      subscribe: vi.fn(() => () => undefined),
      loadArtifactJson,
    } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));

    await waitFor(() => expect(result.current.f6Report).toEqual({ artifactId: "f6-optimization-current" }));
    expect(loadArtifactJson.mock.calls.map(([, artifactId, kind]) => [artifactId, kind])).toEqual([
      ["f4-current", "f4_calculation"],
      ["f5-current", "f5_report"],
      ["f6-optimization-current", "f6_optimization"],
    ]);
  });

  it("keeps successfully loaded worksheet data when one downstream artifact fails", async () => {
    const contextId = "c".repeat(64);
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1" as const,
      sessionId: "session-partial-artifact",
      revision: 5,
      inputRevision: 1,
      state: "review_required" as const,
      activeAttempt: null,
      priorRunReferences: [],
      artifactRefs: [
        { artifactId: "f2-current", kind: "f2_report", revision: 1, validated: true },
        { artifactId: "f4-current", kind: "f4_calculation", revision: 1, validated: true, reviewContextId: contextId },
        { artifactId: "f5-current", kind: "f5_report", revision: 1, validated: true, reviewContextId: contextId },
        { artifactId: "f6-current", kind: "f6_report", revision: 1, validated: true, reviewContextId: contextId },
        { artifactId: "f6-optimization-current", kind: "f6_optimization", revision: 1, validated: true, reviewContextId: contextId },
      ],
    };
    const loadArtifactJson = vi.fn(async (_sessionId: string, artifactId: string) => {
      if (artifactId === "f6-optimization-current") throw new Error("invalid F6 artifact");
      return { artifactId };
    });
    const api = { bootstrap: vi.fn(async () => ({ sessionId: snapshot.sessionId, snapshot, conversation: [] })), subscribe: vi.fn(() => () => undefined), loadArtifactJson } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));

    await waitFor(() => expect(result.current.f2Report).toEqual({ artifactId: "f2-current" }));
    expect(result.current.f4Report).toEqual({ artifactId: "f4-current" });
    expect(result.current.f6Report).toBeUndefined();
  });
});

function snapshot(sessionId = "session-review") {
  return {
    contractVersion: "f8-session-snapshot-v1" as const,
    sessionId,
    revision: 1,
    inputRevision: 0,
    state: "created" as const,
    activeAttempt: null,
    priorRunReferences: [],
    artifactRefs: [],
  };
}