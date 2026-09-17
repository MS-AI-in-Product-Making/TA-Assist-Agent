import { describe, expect, it, vi } from "vitest";
import type { DeepReadonly } from "vue";
import { loadProcessRequirements } from "@ai-assist/knowledge-base/process-requirements";
import type { ProcessRequirementComponentCategory, ProcessRequirementEntry } from "@ai-assist/contracts";
import type { F7SessionSnapshot } from "./api/f7-client";
import { buildF0ProcessGuidance } from "./f0-process-guidance";

const VERSION = "process-requirements-v3" as const;
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

function snapshotWithCategories(
  categories: readonly (ProcessRequirementComponentCategory | undefined)[],
): DeepReadonly<F7SessionSnapshot> {
  const snapshot = snapshotWithFactorCount(categories.length) as F7SessionSnapshot;
  return {
    ...snapshot,
    factors: categories.map((componentCategory, index) => ({
      factorCandidate: {
        factorCandidateId: `candidate-${index + 1}`,
        factorName: index === 0 ? "battery CTS free text must not be inferred" : `Factor ${index + 1}`,
      },
      ...(componentCategory === undefined ? {} : {
        evidence: { componentCategory },
      }),
    })),
  } as unknown as DeepReadonly<F7SessionSnapshot>;
}

function entryIds(result: ReturnType<typeof buildF0ProcessGuidance>): string[] {
  return result.entries.map(({ entryId }) => entryId);
}

function entryState(result: ReturnType<typeof buildF0ProcessGuidance>, entryId: string): string | undefined {
  return result.entries.find((entry) => entry.entryId === entryId)?.state;
}

function cloneEntry(entry: ProcessRequirementEntry): ProcessRequirementEntry {
  return JSON.parse(JSON.stringify(entry)) as ProcessRequirementEntry;
}

describe("buildF0ProcessGuidance", () => {
  it("projects stable de-duplicated confirmed evidence categories into evaluator facts", () => {
    const actual = loadProcessRequirements({ version: VERSION });
    const evaluateProcessRequirements = vi.fn(actual.evaluateProcessRequirements);
    const load: LoadDependency = vi.fn(() => ({
      manifest: actual.manifest,
      listProcessRequirements: actual.listProcessRequirements,
      evaluateProcessRequirements,
    }));

    buildF0ProcessGuidance(snapshotWithCategories([
      "cover-fit-and-function",
      undefined,
      "battery-cts",
      "cover-fit-and-function",
    ]), undefined, { load });

    expect(evaluateProcessRequirements).toHaveBeenCalledWith({
      actor: "all",
      analysisMethod: "one-dimensional-rss",
      toleranceCount: 4,
      componentCategories: ["battery-cts", "cover-fit-and-function"],
    });
  });

  it("does not infer component categories from factor names or pass an empty category fact", () => {
    const actual = loadProcessRequirements({ version: VERSION });
    const evaluateProcessRequirements = vi.fn(actual.evaluateProcessRequirements);
    const load: LoadDependency = vi.fn(() => ({
      manifest: actual.manifest,
      listProcessRequirements: actual.listProcessRequirements,
      evaluateProcessRequirements,
    }));

    const result = buildF0ProcessGuidance(snapshotWithCategories([undefined]), undefined, { load });

    expect(evaluateProcessRequirements).toHaveBeenCalledWith({
      actor: "all",
      analysisMethod: "one-dimensional-rss",
      toleranceCount: 1,
    });
    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("expected available process guidance");
    expect(result.priorityRecommendation).toBeUndefined();
    expect(result.priorityDefinitions.map(({ priority }) => priority)).toEqual(["P0", "P1", "P2", "P3"]);
  });

  it("uses evaluator precedence when P0 and P1 categories both match", () => {
    const result = buildF0ProcessGuidance(snapshotWithCategories([
      "cover-fit-and-function",
      "battery-cts",
    ]));

    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("expected available process guidance");
    expect(result.priorityRecommendation).toEqual({
      selectedPriority: "P0",
      matchedEntryIds: [
        "priority-recommendation-battery-cts",
        "priority-recommendation-cover-fit-and-function",
      ],
      requiresMeDmAlignment: true,
    });
    expect(result.entries.map(({ entryId }) => entryId)).not.toContain("priority-recommendation-battery-cts");
    expect(result.entries.map(({ entryId }) => entryId)).not.toContain("priority-recommendation-cover-fit-and-function");
  });

  it("projects all four governed V3 priority definitions in strict priority order", () => {
    const result = buildF0ProcessGuidance(snapshotWithCategories([]));

    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("expected available process guidance");
    expect(result.priorityDefinitions).toHaveLength(4);
    expect(result.priorityDefinitions.map(({ entryId, priority, title, message, evidence }) => ({
      entryId,
      priority,
      title,
      message,
      effectiveVersion: evidence.effectiveVersion,
    }))).toEqual([
      expect.objectContaining({ entryId: "definition-priority-p0-components", priority: "P0", effectiveVersion: VERSION }),
      expect.objectContaining({ entryId: "definition-priority-p1-components", priority: "P1", effectiveVersion: VERSION }),
      expect.objectContaining({ entryId: "definition-priority-p2-components", priority: "P2", effectiveVersion: VERSION }),
      expect.objectContaining({ entryId: "definition-priority-p3-components", priority: "P3", effectiveVersion: VERSION }),
    ]);
    expect(result.priorityDefinitions.every(({ title, message }) => title.length > 0 && message.length > 0)).toBe(true);
  });

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
    expect(result).toEqual({ status: "unavailable", entries: [], priorityDefinitions: [] });
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
    expect(result).toEqual({ status: "unavailable", entries: [], priorityDefinitions: [] });
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
    expect(result).toEqual({ status: "unavailable", entries: [], priorityDefinitions: [] });
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
    expect(result).toEqual({ status: "unavailable", entries: [], priorityDefinitions: [] });
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
    expect(result).toEqual({ status: "unavailable", entries: [], priorityDefinitions: [] });
  });

  it.each(["missing", "duplicate"] as const)("fails closed when a priority definition is %s", (mutation) => {
    const actual = loadProcessRequirements({ version: VERSION });
    const load: LoadDependency = vi.fn(() => ({
      manifest: actual.manifest,
      evaluateProcessRequirements: actual.evaluateProcessRequirements,
      listProcessRequirements: (query: Parameters<typeof actual.listProcessRequirements>[0]) => {
        const entries = actual.listProcessRequirements(query);
        const target = entries.find(({ entryId }) => entryId === "definition-priority-p2-components");
        if (target === undefined) throw new Error("expected P2 priority definition");
        return mutation === "missing"
          ? entries.filter(({ entryId }) => entryId !== target.entryId)
          : [...entries, target];
      },
    }));

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(1), undefined, { load });

    expect(result).toEqual({ status: "unavailable", entries: [], priorityDefinitions: [] });
  });

  it("fails closed when a priority definition keeps id and title but the controlled message does not match", () => {
    const actual = loadProcessRequirements({ version: VERSION });
    const load: LoadDependency = vi.fn(() => ({
      manifest: actual.manifest,
      evaluateProcessRequirements: actual.evaluateProcessRequirements,
      listProcessRequirements: (query: Parameters<typeof actual.listProcessRequirements>[0]) => (
        actual.listProcessRequirements(query).map((entry) => {
          if (entry.entryId !== "definition-priority-p0-components") return entry;
          const cloned = cloneEntry(entry);
          cloned.message = "Drifted message that should fail closed.";
          return cloned;
        })
      ),
    }));

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(1), undefined, { load });

    expect(result).toEqual({ status: "unavailable", entries: [], priorityDefinitions: [] });
  });

  it("fails closed when a priority definition keeps id and title but the controlled provenance does not match", () => {
    const actual = loadProcessRequirements({ version: VERSION });
    const load: LoadDependency = vi.fn(() => ({
      manifest: actual.manifest,
      evaluateProcessRequirements: actual.evaluateProcessRequirements,
      listProcessRequirements: (query: Parameters<typeof actual.listProcessRequirements>[0]) => (
        actual.listProcessRequirements(query).map((entry) => {
          if (entry.entryId !== "definition-priority-p1-components") return entry;
          const cloned = cloneEntry(entry);
          cloned.provenance = {
            ...cloned.provenance,
            sourceRevision: "drifted-revision",
          };
          return cloned;
        })
      ),
    }));

    const result = buildF0ProcessGuidance(snapshotWithFactorCount(1), undefined, { load });

    expect(result).toEqual({ status: "unavailable", entries: [], priorityDefinitions: [] });
  });
});
