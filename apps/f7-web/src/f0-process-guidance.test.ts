import { describe, expect, it, vi } from "vitest";
import type { DeepReadonly } from "vue";
import { loadProcessRequirements } from "@ai-assist/knowledge-base/process-requirements";
import type { F7SessionSnapshot } from "./api/f7-client";
import { buildF0ProcessGuidance } from "./f0-process-guidance";

const VERSION = "process-requirements-v1" as const;
type LoadDependency = NonNullable<NonNullable<Parameters<typeof buildF0ProcessGuidance>[2]>["load"]>;

function snapshotWithFactorCount(factorCount: number): DeepReadonly<F7SessionSnapshot> {
  return {
    contractId: "f7-analysis-result-v1",
    outputClassification: "confidential",
    sessionId: "session-01",
    status: "worksheet_selection",
    workbook: {
      fileName: "demo.xlsx",
      workbookContentHash: "hash-a",
    },
    selectedWorksheetNames: [],
    worksheetOptions: [],
    factors: Array.from({ length: factorCount }, (_, index) => ({
      factorCandidate: {
        factorCandidateId: `candidate-${index + 1}`,
        factorName: `Factor ${index + 1}`,
      },
    })),
  } as unknown as DeepReadonly<F7SessionSnapshot>;
}

function entryIds(result: ReturnType<typeof buildF0ProcessGuidance>): string[] {
  return result.entries.map(({ entryId }) => entryId);
}

describe("buildF0ProcessGuidance", () => {
  it("uses the real evaluator and only escalates complex stacks above ten factors", () => {
    const seven = buildF0ProcessGuidance(snapshotWithFactorCount(7));
    const eleven = buildF0ProcessGuidance(snapshotWithFactorCount(11));

    expect(seven.status).toBe("available");
    expect(eleven.status).toBe("available");
    if (seven.status !== "available" || eleven.status !== "available") {
      throw new Error("expected available process guidance");
    }

    expect(entryIds(seven)).not.toContain("method-escalation-complex-stack");
    expect(entryIds(eleven)).toContain("method-escalation-complex-stack");
    expect(entryIds(seven)).toContain("requirement-input-completeness");
  });

  it.each([
    [true, true],
    [false, false],
  ] as const)("applies requirement gap guidance only when gap is %s", (gap, expected) => {
    const result = buildF0ProcessGuidance(snapshotWithFactorCount(1), gap);

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available process guidance");
    }

    expect(entryIds(result).includes("requirement-gap-ado-notice")).toBe(expected);
  });

  it("calls the injected loader with version only and fails closed on load errors", () => {
    const load: LoadDependency = vi.fn((request) => {
      expect(request).toEqual({ version: VERSION });
      throw new Error("boom");
    });

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(3), undefined, { load });

    expect(load).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "unavailable", entries: [] });
  });

  it("fails closed when evaluation throws after a successful load", () => {
    const load: LoadDependency = vi.fn((request) => {
      expect(request).toEqual({ version: VERSION });
      return {
        manifest: { version: VERSION },
        listProcessRequirements: () => [],
        evaluateProcessRequirements: () => {
          throw new Error("evaluate failed");
        },
      };
    });

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(3), undefined, { load });

    expect(load).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "unavailable", entries: [] });
  });

  it("fails closed when the loaded manifest version does not match", () => {
    const actual = loadProcessRequirements({ version: VERSION });
    const load: LoadDependency = vi.fn((request) => {
      expect(request).toEqual({ version: VERSION });
      return {
        manifest: { version: "process-requirements-v0" },
        evaluateProcessRequirements: actual.evaluateProcessRequirements,
      };
    });

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(3), undefined, { load });

    expect(load).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "unavailable", entries: [] });
  });
});
