import { describe, expect, it, vi } from "vitest";

import { validateF0Capabilities } from "./index.js";
import type { F0Dependencies } from "./f0.js";

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

function validDependencies(): Required<F0Dependencies> {
  return {
    loadKnowledgeBase: vi.fn(() => ({ manifest: { effectiveVersion: "v1" } })),
    loadInternalToleranceGuidance: vi.fn(() => ({ manifest: { effectiveVersion: "internal-v1" } })),
    loadInterpretationRules: vi.fn(() => ({ manifest: { effectiveVersion: "interpretation-rules-v2" } })),
    loadProcessRequirements: vi.fn(() => ({
      manifest: { version: "process-requirements-v3" },
      evaluateProcessRequirements: vi.fn(() => ({ version: "process-requirements-v3" })),
      listProcessRequirements: vi.fn(() => [{
        provenance: { effectiveVersion: "process-requirements-v3" },
      }]),
    })),
  };
}

describe("validateF0Capabilities", () => {
  it("validates the production versioned knowledge loaders", () => {
    expect(validateF0Capabilities(context())).toEqual({
      featureId: "F0",
      status: "completed",
      versions: ["v1", "internal-v1", "interpretation-rules-v2", "process-requirements-v3"],
      artifactRoot: undefined,
    });
  });

  it("validates F0 without inventing a workflow artifact", async () => {
    const runnerContext = context();
    const dependencies = validDependencies();
    const result = await validateF0Capabilities(runnerContext, dependencies);

    expect(dependencies.loadKnowledgeBase).toHaveBeenCalledExactlyOnceWith({ version: "v1" });
    expect(dependencies.loadInternalToleranceGuidance).toHaveBeenCalledExactlyOnceWith({ version: "internal-v1" });
    expect(dependencies.loadInterpretationRules).toHaveBeenCalledExactlyOnceWith({ version: "interpretation-rules-v2" });
    expect(dependencies.loadProcessRequirements).toHaveBeenCalledExactlyOnceWith({ version: "process-requirements-v3" });
    expect(dependencies.loadKnowledgeBase.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.loadInternalToleranceGuidance.mock.invocationCallOrder[0]!,
    );
    expect(dependencies.loadInternalToleranceGuidance.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.loadInterpretationRules.mock.invocationCallOrder[0]!,
    );
    expect(dependencies.loadInterpretationRules.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.loadProcessRequirements.mock.invocationCallOrder[0]!,
    );
    expect(result).toEqual({
      status: "completed",
      featureId: "F0",
      versions: ["v1", "internal-v1", "interpretation-rules-v2", "process-requirements-v3"],
      artifactRoot: undefined,
    });
    expect(runnerContext.emit.mock.calls.map(([event]) => event.kind)).toEqual([
      "stage_started",
      "stage_completed",
    ]);
  });

  it("reads an injected loader dependency exactly once before validating its result", () => {
    const runnerContext = context();
    const injectedLoader = vi.fn(() => ({ manifest: { version: "process-requirements-v1" } }));
    let getterReads = 0;
    const dependencies = validDependencies();
    Object.defineProperty(dependencies, "loadProcessRequirements", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return getterReads === 1 ? injectedLoader : undefined;
      },
    });

    expect(() => validateF0Capabilities(runnerContext, dependencies)).toThrow(expect.objectContaining({
      name: "Error",
      code: "evidence_mismatch",
      retryable: false,
    }));
    expect(getterReads).toBe(1);
    expect(injectedLoader).toHaveBeenCalledExactlyOnceWith({ version: "process-requirements-v3" });
    expect(runnerContext.emit).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_completed" }));
  });

  it("normalizes a throwing dependency getter without leaking raw details", () => {
    const runnerContext = context();
    const dependencies = validDependencies();
    Object.defineProperty(dependencies, "loadProcessRequirements", {
      enumerable: true,
      get: () => { throw new Error("Missing C:\\confidential\\source.xlsx"); },
    });

    let thrown: unknown;
    try {
      validateF0Capabilities(runnerContext, dependencies);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      name: "Error",
      code: "internal_error",
      summary: "Workflow runner failed unexpectedly.",
      retryable: false,
    });
    expect(JSON.stringify(thrown)).not.toContain("confidential");
    expect(runnerContext.emit).not.toHaveBeenCalled();
  });

  it.each([
    ["knowledge base", "loadKnowledgeBase", "effectiveVersion"],
    ["internal guidance", "loadInternalToleranceGuidance", "effectiveVersion"],
    ["interpretation rules", "loadInterpretationRules", "effectiveVersion"],
    ["process requirements", "loadProcessRequirements", "version"],
  ] as const)("rejects missing and wrong %s manifests without completing the stage", (
    _label,
    dependencyName,
    versionField,
  ) => {
    for (const result of [{}, { manifest: { [versionField]: "wrong" } }]) {
      const runnerContext = context();
      const dependencies = validDependencies();
      dependencies[dependencyName] = vi.fn(() => result) as never;

      expect(() => validateF0Capabilities(runnerContext, dependencies)).toThrow(expect.objectContaining({
        name: "Error",
        code: "evidence_mismatch",
        retryable: false,
      }));
      expect(runnerContext.emit).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_completed" }));
    }
  });

  it.each([
    ["evaluation", {
      manifest: { version: "process-requirements-v3" },
      evaluateProcessRequirements: () => ({ version: "process-requirements-v2" }),
      listProcessRequirements: () => [],
    }],
    ["entry provenance", {
      manifest: { version: "process-requirements-v3" },
      evaluateProcessRequirements: () => ({ version: "process-requirements-v3" }),
      listProcessRequirements: () => [{ provenance: { effectiveVersion: "process-requirements-v2" } }],
    }],
  ] as const)("rejects mixed-version process requirements %s", (_kind, processRequirements) => {
    const runnerContext = context();
    const dependencies = validDependencies();
    dependencies.loadProcessRequirements = vi.fn(() => processRequirements);

    expect(() => validateF0Capabilities(runnerContext, dependencies)).toThrow(expect.objectContaining({
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
      loadProcessRequirements: vi.fn(() => { throw new Error("Cannot find module 'process-requirements-v3'."); }),
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
      loadProcessRequirements: vi.fn(() => ({ manifest: { version: "process-requirements-v3" } })),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "internal_error",
      summary: "Workflow runner failed unexpectedly.",
    }));
    expect(runnerContext.emit).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_completed" }));
  });
});