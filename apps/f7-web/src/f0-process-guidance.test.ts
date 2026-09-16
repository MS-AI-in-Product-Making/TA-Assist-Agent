import { describe, expect, it, vi } from "vitest";
import type { DeepReadonly } from "vue";
import { loadProcessRequirements } from "@ai-assist/knowledge-base/process-requirements";
import type { F7SessionSnapshot } from "./api/f7-client";
import { buildF0ProcessGuidance } from "./f0-process-guidance";

const VERSION = "process-requirements-v2" as const;
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

function entryState(result: ReturnType<typeof buildF0ProcessGuidance>, entryId: string): string | undefined {
  return result.entries.find((entry) => entry.entryId === entryId)?.state;
}

describe("buildF0ProcessGuidance", () => {
  it("lists small- and complex-stack guidance and warns for complex stacks only above ten factors", () => {
    const three = buildF0ProcessGuidance(snapshotWithFactorCount(3));
    const seven = buildF0ProcessGuidance(snapshotWithFactorCount(7));
    const eleven = buildF0ProcessGuidance(snapshotWithFactorCount(11));

    expect(three.status).toBe("available");
    expect(seven.status).toBe("available");
    expect(eleven.status).toBe("available");
    if (three.status !== "available" || seven.status !== "available" || eleven.status !== "available") {
      throw new Error("expected available process guidance");
    }

    expect(entryIds(three)).toContain("instruction-consider-worst-case-small-stack");
    expect(entryState(three, "instruction-consider-worst-case-small-stack")).toBe("guidance");
    expect(entryIds(seven)).toContain("instruction-consider-worst-case-small-stack");
    expect(entryState(seven, "instruction-consider-worst-case-small-stack")).toBe("guidance");
    expect(entryIds(seven)).toContain("method-escalation-complex-stack");
    expect(entryIds(eleven)).toContain("method-escalation-complex-stack");
    expect(entryState(seven, "method-escalation-complex-stack")).toBe("guidance");
    expect(entryState(eleven, "method-escalation-complex-stack")).toBe("warning");
    expect(entryIds(seven)).toContain("requirement-input-completeness");
    expect(entryState(seven, "requirement-input-completeness")).toBe("guidance");
    expect(entryIds(seven)).not.toContain("milestone-odm-p0-asr");
  });

  it.each([
    [true, true],
    [false, false],
  ] as const)("marks requirement gap guidance as warning only when gap is %s", (gap, expected) => {
    const result = buildF0ProcessGuidance(snapshotWithFactorCount(1), gap);

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available process guidance");
    }

    expect(entryIds(result)).toContain("requirement-gap-ado-notice");
    expect(entryState(result, "requirement-gap-ado-notice")).toBe(expected ? "warning" : "guidance");
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
        manifest: { version: "process-requirements-v1" },
        listProcessRequirements: actual.listProcessRequirements,
        evaluateProcessRequirements: actual.evaluateProcessRequirements,
      };
    });

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(3), undefined, { load });

    expect(load).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "unavailable", entries: [] });
  });

  it("fails closed when the evaluation version does not match the manifest", () => {
    const actual = loadProcessRequirements({ version: VERSION });
    const load: LoadDependency = vi.fn((request) => {
      expect(request).toEqual({ version: VERSION });
      return {
        manifest: { version: VERSION },
        listProcessRequirements: actual.listProcessRequirements,
        evaluateProcessRequirements: (
          facts: Parameters<typeof actual.evaluateProcessRequirements>[0],
        ) => ({
          ...actual.evaluateProcessRequirements(facts),
          version: "process-requirements-v1" as const,
        }),
      };
    });

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(3), undefined, { load });

    expect(load).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "unavailable", entries: [] });
  });

  it.each([
    ["candidate", (entry: ReturnType<ReturnType<typeof loadProcessRequirements>["listProcessRequirements"]>[number]) => (
      entry.entryId === "instruction-consider-worst-case-small-stack"
    )],
    ["definition", (entry: ReturnType<ReturnType<typeof loadProcessRequirements>["listProcessRequirements"]>[number]) => (
      entry.entryType === "definition"
    )],
  ] as const)("fails closed when a listed %s entry has a mismatched effective version", (_kind, isTarget) => {
    const actual = loadProcessRequirements({ version: VERSION });
    const targetEntry = actual.listProcessRequirements({}).find(isTarget);
    if (targetEntry === undefined) {
      throw new Error("expected a process requirement entry for the mixed-version test");
    }

    const load: LoadDependency = vi.fn((request) => {
      expect(request).toEqual({ version: VERSION });
      return {
        manifest: { version: VERSION },
        evaluateProcessRequirements: actual.evaluateProcessRequirements,
        listProcessRequirements: (
          query: Parameters<typeof actual.listProcessRequirements>[0],
        ) => actual.listProcessRequirements(query).map((entry) => (
          entry.entryId === targetEntry.entryId
            ? {
                ...entry,
                provenance: {
                  ...entry.provenance,
                  effectiveVersion: "process-requirements-v1" as const,
                },
              }
            : entry
        )),
      };
    });

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(3), undefined, { load });

    expect(load).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "unavailable", entries: [] });
  });
});
