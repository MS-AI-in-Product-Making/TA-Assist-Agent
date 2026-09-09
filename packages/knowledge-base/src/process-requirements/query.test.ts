import { describe, expect, it } from "vitest";
import {
  processRequirementEvaluationSchema,
  typedErrorSchema,
} from "@ai-assist/contracts";
import { loadProcessRequirements } from "./query.js";

function entryIds(result: ReturnType<ReturnType<typeof loadProcessRequirements>["evaluateProcessRequirements"]>): string[] {
  return result.matchedEntries.map(({ entryId }) => entryId);
}

function captureTypedError(invoke: () => unknown) {
  try {
    invoke();
  } catch (error) {
    const parsed = typedErrorSchema.safeParse(error);
    expect(parsed.success).toBe(true);
    if (parsed.success) return { error, typedError: parsed.data };
  }
  throw new Error("expected a typed error");
}

describe("process requirement queries", () => {
  it("matches complex stacks only above the exclusive threshold", () => {
    const knowledge = loadProcessRequirements({ version: "process-requirements-v1" });

    const complex = knowledge.evaluateProcessRequirements({
      analysisMethod: "one-dimensional-rss",
      toleranceCount: 11,
      hasThreeDimensionalSensitivity: true,
    });
    const threshold = knowledge.evaluateProcessRequirements({
      analysisMethod: "one-dimensional-rss",
      toleranceCount: 10,
      hasThreeDimensionalSensitivity: false,
      subject: "other",
    });

    expect(entryIds(complex)).toContain("method-escalation-complex-stack");
    expect(entryIds(complex)).toContain("method-escalation-three-dimensional-sensitivity");
    expect(entryIds(threshold)).not.toContain("method-escalation-complex-stack");
  });

  it("matches camera FOV escalation", () => {
    const result = loadProcessRequirements({ version: "process-requirements-v1" })
      .evaluateProcessRequirements({
        analysisMethod: "one-dimensional-rss",
        subject: "camera-fov-clearance",
      });

    expect(entryIds(result)).toContain("camera-fov-escalation");
  });

  it.each([
    ["cts", 6, "target-cts-six-sigma"],
    ["ctf", 4, "target-ctf-four-sigma"],
  ] as const)("resolves the %s sigma target", (characteristicClass, sigma, entryId) => {
    const result = loadProcessRequirements({ version: "process-requirements-v1" })
      .evaluateProcessRequirements({ characteristicClass });

    expect(result.resolvedTargets).toEqual({ sigma });
    expect(entryIds(result)).toContain(entryId);
  });

  it.each([
    [
      { actor: "odm", priority: "P0", lifecycleStage: "asr" },
      "milestone-odm-p0-asr",
    ],
    [
      { actor: "odm", priority: "P2", lifecycleStage: "before-tooling" },
      "milestone-odm-p2-before-tooling",
    ],
    [
      { actor: "odm", lifecycleStage: "after-tooling-trial-or-build" },
      "requirement-post-build-real-part-data",
    ],
    [
      { actor: "subsystem-supplier", characteristicClass: "cts", lifecycleStage: "dfm" },
      "milestone-subsystem-dfm-cts",
    ],
    [
      { requirementGapPresent: true },
      "requirement-gap-ado-notice",
    ],
  ] as const)("matches controlled process scenario %#", (facts, expectedEntryId) => {
    const result = loadProcessRequirements({ version: "process-requirements-v1" })
      .evaluateProcessRequirements(facts);

    expect(entryIds(result)).toContain(expectedEntryId);
  });

  it("sorts matches by severity and then entry ID", () => {
    const result = loadProcessRequirements({ version: "process-requirements-v1" })
      .evaluateProcessRequirements({
        actor: "all",
        analysisMethod: "one-dimensional-rss",
        characteristicClass: "cts",
        factorRepresentation: "position",
        requirementGapPresent: true,
        workbookArea: "auto-summary",
        toleranceCount: 11,
        hasThreeDimensionalSensitivity: false,
        subject: "other",
      });
    const rank = new Map([
      ["escalation", 0],
      ["warning", 1],
      ["requirement", 2],
      ["milestone", 3],
      ["instruction", 4],
    ]);

    expect(result.status).toBe("matched");
    for (let index = 1; index < result.matchedEntries.length; index += 1) {
      const previous = result.matchedEntries[index - 1]!;
      const current = result.matchedEntries[index]!;
      expect(rank.get(previous.entryType)).toBeLessThanOrEqual(rank.get(current.entryType)!);
      if (previous.entryType === current.entryType) {
        expect(previous.entryId < current.entryId).toBe(true);
      }
    }
  });

  it("filters listed entries by topic and entry type", () => {
    const knowledge = loadProcessRequirements({ version: "process-requirements-v1" });
    const definitions = knowledge.listProcessRequirements({ entryTypes: ["definition"] });
    const reviewMilestones = knowledge.listProcessRequirements({
      topics: ["review"],
      entryTypes: ["milestone"],
    });

    expect(definitions).toHaveLength(10);
    expect(definitions.every(({ entryType }) => entryType === "definition")).toBe(true);
    expect(reviewMilestones.length).toBeGreaterThan(0);
    expect(reviewMilestones.every(({ topic, entryType }) => (
      topic === "review" && entryType === "milestone"
    ))).toBe(true);
  });

  it("keeps definitions list-only", () => {
    const result = loadProcessRequirements({ version: "process-requirements-v1" })
      .evaluateProcessRequirements({});

    expect(result.status).toBe("not-applicable");
    expect(result.matchedEntries).toEqual([]);
    expect(entryIds(result).some((entryId) => entryId.startsWith("definition-"))).toBe(false);
    expect(processRequirementEvaluationSchema.safeParse(result).success).toBe(true);
  });

  it("reports relevant absent facts without activating entries", () => {
    const result = loadProcessRequirements({ version: "process-requirements-v1" })
      .evaluateProcessRequirements({ analysisMethod: "one-dimensional-rss" });

    expect(result).toMatchObject({
      status: "insufficient-facts",
      matchedEntries: [],
      missingFacts: ["hasThreeDimensionalSensitivity", "subject", "toleranceCount"],
      factsUsed: ["analysisMethod"],
    });
    expect(processRequirementEvaluationSchema.safeParse(result).success).toBe(true);
  });

  it("returns schema-valid not-applicable when supplied facts exclude every relevant entry", () => {
    const result = loadProcessRequirements({ version: "process-requirements-v1" })
      .evaluateProcessRequirements({
        analysisMethod: "three-dimensional-variation",
        toleranceCount: 11,
        hasThreeDimensionalSensitivity: true,
        subject: "other",
      });

    expect(result).toEqual({
      version: "process-requirements-v1",
      status: "not-applicable",
      resolvedTargets: {},
      factsUsed: [],
      matchedEntries: [],
      missingFacts: [],
    });
    expect(processRequirementEvaluationSchema.safeParse(result).success).toBe(true);
  });

  it("rejects unsupported versions and extra request fields without echoing untrusted values", () => {
    const marker = "caller-private-marker";
    const loadError = captureTypedError(() => loadProcessRequirements({ version: marker }));
    const knowledge = loadProcessRequirements({ version: "process-requirements-v1" });
    const listError = captureTypedError(() => knowledge.listProcessRequirements({ marker }));
    const evaluationError = captureTypedError(() => knowledge.evaluateProcessRequirements({ marker }));

    for (const { error, typedError } of [loadError, listError, evaluationError]) {
      expect(typedError.code).toBe("validation_error");
      expect(JSON.stringify(error)).not.toContain(marker);
      expect((error as Error).message).not.toContain(marker);
    }
  });

  it("returns fresh deeply frozen list and evaluation results on repeat calls", () => {
    const knowledge = loadProcessRequirements({ version: "process-requirements-v1" });
    const firstList = knowledge.listProcessRequirements({ topics: ["analysis-method"] });
    const secondList = knowledge.listProcessRequirements({ topics: ["analysis-method"] });
    const facts = { characteristicClass: "cts" } as const;
    const firstEvaluation = knowledge.evaluateProcessRequirements(facts);
    const secondEvaluation = knowledge.evaluateProcessRequirements(facts);

    expect(firstList).toEqual(secondList);
    expect(firstList).not.toBe(secondList);
    expect(firstList[0]).not.toBe(secondList[0]);
    expect(Object.isFrozen(firstList)).toBe(true);
    expect(Object.isFrozen(firstList[0]?.applicability)).toBe(true);
    expect(firstEvaluation).toEqual(secondEvaluation);
    expect(firstEvaluation).not.toBe(secondEvaluation);
    expect(firstEvaluation.matchedEntries[0]).not.toBe(secondEvaluation.matchedEntries[0]);
    expect(Object.isFrozen(firstEvaluation)).toBe(true);
    expect(Object.isFrozen(firstEvaluation.matchedEntries[0]?.evidence)).toBe(true);
    expect(() => {
      (firstList as unknown as Array<unknown>).push({});
    }).toThrow();
    expect(() => {
      (firstEvaluation.matchedEntries as unknown as Array<unknown>).push({});
    }).toThrow();
    expect(knowledge.listProcessRequirements({ topics: ["analysis-method"] })).toEqual(secondList);
    expect(knowledge.evaluateProcessRequirements(facts)).toEqual(secondEvaluation);
  });
});