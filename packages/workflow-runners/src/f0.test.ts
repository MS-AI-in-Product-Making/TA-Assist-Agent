import { describe, expect, it, vi } from "vitest";

import { validateF0Capabilities } from "./index.js";

function context() {
  const repositoryRoot = "C:/repo";
  return {
    repositoryRoot,
    managedOutputRoot: `${repositoryRoot}/managed-output`,
    attemptId: "f0-attempt",
    signal: new AbortController().signal,
    emit: vi.fn(),
  };
}

describe("validateF0Capabilities", () => {
  it("validates the production versioned knowledge loaders", () => {
    expect(validateF0Capabilities(context())).toMatchObject({
      featureId: "F0",
      status: "completed",
      versions: ["v1", "internal-v1", "interpretation-rules-v2"],
    });
  });

  it("validates F0 without inventing a workflow artifact", async () => {
    const runnerContext = context();
    const result = await validateF0Capabilities(runnerContext, {
      loadKnowledgeBase: vi.fn(() => ({ manifest: { effectiveVersion: "v1" } })),
      loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } })),
      loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } })),
    });

    expect(result).toEqual(expect.objectContaining({
      status: "completed",
      featureId: "F0",
      versions: ["v1", "internal-v1", "interpretation-rules-v2"],
      artifactRoot: undefined,
    }));
    expect(runnerContext.emit).toHaveBeenCalled();
  });

  it("rejects missing or wrong manifest versions instead of falling back", async () => {
    expect(() => validateF0Capabilities(context(), {
      loadKnowledgeBase: vi.fn(() => ({ manifest: {} })),
      loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "wrong" } })),
      loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } })),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "evidence_mismatch",
      retryable: false,
    }));
  });

  it("normalizes ordinary dependency failures to typed errors", async () => {
    expect(() => validateF0Capabilities(context(), {
      loadKnowledgeBase: vi.fn(() => { throw new Error("Cannot find module '@ai-assist/knowledge-base'."); }),
      loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } })),
      loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } })),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "dependency_error",
      retryable: false,
    }));
  });

  it("normalizes unknown failures without leaking raw details", async () => {
    expect(() => validateF0Capabilities(context(), {
      loadKnowledgeBase: vi.fn(() => { throw "secret-token=abc"; }),
      loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } })),
      loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } })),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "internal_error",
      summary: "Workflow runner failed unexpectedly.",
    }));
  });
});