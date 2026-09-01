import { describe, expect, it, vi } from "vitest";

import { createTaRuntimeSkillFacades } from "./ta-runtime-skill-facades.js";

describe("ta runtime skill facades", () => {
  it("delegates calculation exactly once to the existing runner", async () => {
    const calculationResult = { featureId: "F4", status: "completed", outputDirectory: "managed/f4", manifestPath: "managed/f4/manifest.json" };
    const runF4 = vi.fn(() => calculationResult);
    const facades = createTaRuntimeSkillFacades({ runF4Calculation: runF4 as never });

    const result = await facades.tolerancePerformanceCalculation.invoke({
      inputRevision: 4,
      idempotencyKey: "attempt-7:f4_running",
      artifactReferences: [{ artifactId: "f2-report", kind: "f2_report", revision: 4, validated: true }],
      worksheetScope: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" },
      input: {
        request: { artifactRoot: "managed/f2", selectedWorksheetNames: ["Analysis-A"] },
        context: { attemptId: "attempt-7", repositoryRoot: ".", managedOutputRoot: "managed/f4", signal: new AbortController().signal, emit: () => {} },
      },
    });

    expect(runF4).toHaveBeenCalledTimes(1);
    expect(result.output).toEqual(calculationResult);
  });

  it("returns facade output deep-equal to legacy runner fixture output", async () => {
    const fixtureResult = {
      featureId: "F4",
      status: "completed",
      outputDirectory: "managed/f4",
      calculationJsonPath: "managed/f4/Feature4-Calculation.json",
      manifestPath: "managed/f4/manifest.json",
      summary: { worksheetCount: 1 },
    };
    const runF4 = vi.fn(() => fixtureResult);
    const facades = createTaRuntimeSkillFacades({ runF4Calculation: runF4 as never });
    const invocation = {
      inputRevision: 4,
      idempotencyKey: "attempt-8:f4_running",
      artifactReferences: [{ artifactId: "f2-report", kind: "f2_report", revision: 4, validated: true }],
      worksheetScope: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" as const },
      input: {
        request: { artifactRoot: "managed/f2", selectedWorksheetNames: ["Analysis-A"] },
        context: { attemptId: "attempt-8", repositoryRoot: ".", managedOutputRoot: "managed/f4", signal: new AbortController().signal, emit: () => {} },
      },
    };

    const legacy = runF4(invocation.input.request, invocation.input.context);
    const facadeResult = await facades.tolerancePerformanceCalculation.invoke(invocation);

    expect(facadeResult.status).toBe("completed");
    expect(facadeResult.output).toEqual(legacy);
  });
});
