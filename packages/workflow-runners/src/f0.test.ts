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
    expect(validateF0Capabilities(context())).toEqual({
      featureId: "F0",
      status: "completed",
      versions: ["v1", "internal-v1", "interpretation-rules-v2", "process-requirements-v1"],
      artifactRoot: undefined,
    });
  });

  it("validates F0 without inventing a workflow artifact", async () => {
    const runnerContext = context();
    const loadKnowledgeBase = vi.fn(() => ({ manifest: { effectiveVersion: "v1" } }));
    const loadInternalToleranceGuidance = vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } }));
    const loadInterpretationRules = vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } }));
    const loadProcessRequirements = vi.fn(() => ({ manifest: { version: "process-requirements-v1" } }));
    const result = await validateF0Capabilities(runnerContext, {
      loadKnowledgeBase,
      loadInternalToleranceGuidance,
      loadInterpretationRules,
      loadProcessRequirements,
    });

    expect(loadKnowledgeBase).toHaveBeenCalledWith({ version: "v1" });
    expect(loadInternalToleranceGuidance).toHaveBeenCalledWith({ version: "internal-v1" });
    expect(loadInterpretationRules).toHaveBeenCalledWith({ version: "interpretation-rules-v2" });
    expect(loadProcessRequirements).toHaveBeenCalledWith({ version: "process-requirements-v1" });
    expect(result).toEqual({
      status: "completed",
      featureId: "F0",
      versions: ["v1", "internal-v1", "interpretation-rules-v2", "process-requirements-v1"],
      artifactRoot: undefined,
    });
    expect(runnerContext.emit).toHaveBeenCalled();
  });

  it.each([
    ["missing", vi.fn(() => ({}))],
    ["wrong", vi.fn(() => ({ manifest: { version: "wrong" } }))],
  ])("rejects a %s process requirements manifest without completing the stage", (_case, loadProcessRequirements) => {
    const runnerContext = context();

    expect(() => validateF0Capabilities(runnerContext, {
      loadKnowledgeBase: vi.fn(() => ({ manifest: { effectiveVersion: "v1" } })),
      loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } })),
      loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } })),
      loadProcessRequirements,
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "evidence_mismatch",
      retryable: false,
    }));
    expect(runnerContext.emit).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_completed" }));
  });

  it("normalizes process requirements loader errors without completing the stage", async () => {
    const runnerContext = context();

    expect(() => validateF0Capabilities(runnerContext, {
      loadKnowledgeBase: vi.fn(() => ({ manifest: { effectiveVersion: "v1" } })),
      loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } })),
      loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } })),
      loadProcessRequirements: vi.fn(() => { throw new Error("Cannot find module 'process-requirements-v1'."); }),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "dependency_error",
      retryable: false,
    }));
    expect(runnerContext.emit).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_completed" }));
  });

  it("normalizes unknown failures without leaking raw details", async () => {
    const runnerContext = context();

    expect(() => validateF0Capabilities(runnerContext, {
      loadKnowledgeBase: vi.fn(() => { throw "secret-token=abc"; }),
      loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } })),
      loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } })),
      loadProcessRequirements: vi.fn(() => ({ manifest: { version: "process-requirements-v1" } })),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "internal_error",
      summary: "Workflow runner failed unexpectedly.",
    }));
    expect(runnerContext.emit).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_completed" }));
  });
});