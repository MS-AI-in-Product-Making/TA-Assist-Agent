import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WorkbenchApi } from "./api.js";
import { useWorkbenchSession } from "./use-session.js";

describe("useWorkbenchSession review artifacts", () => {
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
        { artifactId: "f4-current", kind: "f4_calculation", revision: 4, validated: true, reviewContextId: currentContext },
        { artifactId: "f5-current", kind: "f5_report", revision: 4, validated: true, reviewContextId: currentContext },
        { artifactId: "f6-current", kind: "f6_report", revision: 4, validated: true, reviewContextId: currentContext },
      ],
    };
    const loadArtifactJson = vi.fn(async (_sessionId: string, artifactId: string) => ({ artifactId }));
    const api = {
      bootstrap: vi.fn(async () => ({ sessionId: snapshot.sessionId, snapshot, conversation: [] })),
      subscribe: vi.fn(() => () => undefined),
      loadArtifactJson,
    } as unknown as WorkbenchApi;

    const { result } = renderHook(() => useWorkbenchSession(api));

    await waitFor(() => expect(result.current.f6Report).toEqual({ artifactId: "f6-current" }));
    expect(loadArtifactJson.mock.calls.map(([, artifactId, kind]) => [artifactId, kind])).toEqual([
      ["f4-current", "f4_calculation"],
      ["f5-current", "f5_report"],
      ["f6-current", "f6_report"],
    ]);
  });
});