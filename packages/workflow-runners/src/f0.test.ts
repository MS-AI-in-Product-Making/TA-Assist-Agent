import { describe, expect, it, vi } from "vitest";

import { validateF0Capabilities } from "./index.js";

describe("validateF0Capabilities", () => {
  it("validates F0 without inventing a workflow artifact", async () => {
    const emit = vi.fn();
    const repositoryRoot = "C:/repo";
    const result = await validateF0Capabilities({
      repositoryRoot,
      managedOutputRoot: `${repositoryRoot}/managed-output`,
      attemptId: "f0-attempt",
      signal: new AbortController().signal,
      emit,
    }, {
      loadKnowledgeBase: vi.fn(() => ({ manifest: { effectiveVersion: "v1" } })),
      loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } })),
      loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v1" } })),
    });

    expect(result).toEqual(expect.objectContaining({
      status: "completed",
      featureId: "F0",
      versions: ["v1", "internal-v1", "interpretation-rules-v1"],
      artifactRoot: undefined,
    }));
    expect(emit).toHaveBeenCalled();
  });
});