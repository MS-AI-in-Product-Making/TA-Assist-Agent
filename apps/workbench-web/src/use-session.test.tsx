import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WorkbenchApi } from "./api.js";
import { useWorkbenchSession } from "./use-session.js";

describe("useWorkbenchSession review artifacts", () => {
  it("loads the server-projected F2 findings at the downstream decision gate", async () => {
    const current = { ...snapshot("session-findings"), state: "downstream_scope_required" as const, revision: 3, inputRevision: 1 };
    const projection = { contractVersion: "f2-findings-decision-projection-v1", downstreamReadyWorksheetNames: ["Analysis-A"] };
    const api = {
      bootstrap: vi.fn(async () => ({ sessionId: current.sessionId, snapshot: current, conversation: [] })),
      subscribe: vi.fn(() => () => undefined),
      loadArtifactJson: vi.fn(),
      readF2Findings: vi.fn(async () => projection),
    } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));

    await waitFor(() => expect(result.current.f2Findings).toEqual(projection));
    expect(api.readF2Findings).toHaveBeenCalledWith("session-findings");
  });

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
      downstreamScopeSelection: {
        workbookContentHash: "c".repeat(64),
        selectedWorksheetNames: ["AJ_GAP"],
        confirmed: true,
        provenance: "user" as const,
      },
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

  it("loads the current validated F3 report before a complete review context exists", async () => {
    const contextId = "d".repeat(64);
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1" as const,
      sessionId: "session-ado-decision",
      revision: 6,
      inputRevision: 1,
      state: "ado_decision_required" as const,
      activeAttempt: null,
      priorRunReferences: [],
      artifactRefs: [
        { artifactId: "f2-current", kind: "f2_report", revision: 1, validated: true },
        { artifactId: "f3-current", kind: "f3_report", revision: 1, validated: true, reviewContextId: contextId },
      ],
    };
    const loadArtifactJson = vi.fn(async (_sessionId: string, artifactId: string) => ({ artifactId }));
    const api = {
      bootstrap: vi.fn(async () => ({ sessionId: snapshot.sessionId, snapshot, conversation: [] })),
      subscribe: vi.fn(() => () => undefined),
      loadArtifactJson,
    } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));

    await waitFor(() => expect(result.current.f3Report).toEqual({ artifactId: "f3-current" }));
    expect(loadArtifactJson.mock.calls.map(([, artifactId, kind]) => [artifactId, kind])).toEqual([
      ["f2-current", "f2_report"],
      ["f3-current", "f3_report"],
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

  it("clears only stale ADO read errors after a later successful poll", async () => {
    const projection = {
      contractVersion: "f8-ado-projection-v1" as const,
      sessionId: "session-ado-poll",
      state: "blocked" as const,
      actionId: "ado-validation:session-ado-poll:3",
      expectedRevision: 3,
      reason: "Surface validation action is unavailable.",
    };
    const api = {
      bootstrap: vi.fn(async () => ({
        sessionId: "session-ado-poll",
        snapshot: {
          contractVersion: "f8-session-snapshot-v1" as const,
          sessionId: "session-ado-poll",
          revision: 3,
          inputRevision: 1,
          state: "ado_action_pending" as const,
          activeAttempt: null,
          priorRunReferences: [],
          artifactRefs: [],
        },
        conversation: [],
      })),
      subscribe: vi.fn(() => () => undefined),
      readAdoProjection: vi.fn()
        .mockRejectedValueOnce(new Error("temporary ado read failure"))
        .mockResolvedValue(projection),
    } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));

    await waitFor(() => expect(result.current.error?.summary).toBe("ADO status read failed."));
    await waitFor(() => expect(result.current.adoProjection?.state).toBe("blocked"), { timeout: 15_000 });
    expect(result.current.error).toBeUndefined();
    expect(api.readAdoProjection).toHaveBeenCalledTimes(2);
  });

  it("preserves unrelated errors when ADO reads succeed", async () => {
    const api = {
      bootstrap: vi.fn(async () => ({
        sessionId: "session-ado-preserve-error",
        snapshot: {
          contractVersion: "f8-session-snapshot-v1" as const,
          sessionId: "session-ado-preserve-error",
          revision: 2,
          inputRevision: 1,
          state: "ado_action_pending" as const,
          activeAttempt: null,
          priorRunReferences: [],
          artifactRefs: [{ artifactId: "f2-current", kind: "f2_report", revision: 1, validated: true }],
        },
        conversation: [],
      })),
      subscribe: vi.fn(() => () => undefined),
      loadArtifactJson: vi.fn(async () => {
        throw new Error("f2 artifact unavailable");
      }),
      readAdoProjection: vi.fn(async () => ({
        contractVersion: "f8-ado-projection-v1" as const,
        sessionId: "session-ado-preserve-error",
        state: "blocked" as const,
        actionId: "ado-validation:session-ado-preserve-error:2",
        expectedRevision: 2,
        reason: "Surface validation action is unavailable.",
      })),
    } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));

    await waitFor(() => expect(result.current.adoProjection?.state).toBe("blocked"));
    await waitFor(() => expect(result.current.error?.summary).toBe("Governed artifact read failed."));
  });

  it("invokes start_new_ado_write_generation and refreshes ADO projection", async () => {
    const api = {
      bootstrap: vi.fn(async () => ({
        sessionId: "session-start-new-generation",
        snapshot: {
          contractVersion: "f8-session-snapshot-v1" as const,
          sessionId: "session-start-new-generation",
          revision: 4,
          inputRevision: 1,
          state: "ado_action_pending" as const,
          activeAttempt: null,
          priorRunReferences: [],
          artifactRefs: [],
        },
        conversation: [],
      })),
      subscribe: vi.fn(() => () => undefined),
      readAdoProjection: vi.fn(async () => ({
        contractVersion: "f8-ado-projection-v1" as const,
        sessionId: "session-start-new-generation",
        state: "validation_pending" as const,
        actionId: "ado-validation:session-start-new-generation:5",
        expectedRevision: 5,
        startedAt: "2026-09-01T00:00:00.000Z",
        expiresAt: "2026-09-01T00:15:00.000Z",
      })),
      startNewAdoWriteGeneration: vi.fn(async () => ({
        contractVersion: "f8-session-snapshot-v1" as const,
        sessionId: "session-start-new-generation",
        revision: 5,
        inputRevision: 1,
        state: "ado_action_pending" as const,
        activeAttempt: null,
        priorRunReferences: [],
        artifactRefs: [],
      })),
    } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));

    await waitFor(() => expect(result.current.sessionId).toBe("session-start-new-generation"));
    await act(async () => {
      await result.current.startNewAdoWriteGeneration();
    });

    expect(api.startNewAdoWriteGeneration).toHaveBeenCalledWith("session-start-new-generation");
    expect(api.readAdoProjection).toHaveBeenCalled();
    await waitFor(() => expect(result.current.adoProjection?.state).toBe("validation_pending"));
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