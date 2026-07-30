import { describe, expect, expectTypeOf, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import * as knowledgeBase from "../index.js";
import {
  createInterpretationKnowledgeSnapshot,
  createInterpretationRules,
  type DeepReadonly,
  type InterpretationKnowledgeSeedPackage,
  type InterpretationKnowledgeSnapshot,
} from "../index.js";
import {
  createValidInterpretationKnowledgeSeedPackage,
  refreshInterpretationKnowledgeManifest,
} from "./test-support.js";

const PACKAGE_REFERENCE = "interpretation-rules-v1";

function getValidationError(action: () => unknown): {
  code: string;
  summary: string;
  message: string;
  affectedInputReferences: string[];
} {
  try {
    action();
  } catch (error) {
    expect(typedErrorSchema.safeParse(error).success).toBe(true);
    return error as {
      code: string;
      summary: string;
      message: string;
      affectedInputReferences: string[];
    };
  }
  throw new Error("Expected a validation error.");
}

function expectDependencyError(seed: unknown): void {
  const error = getValidationError(() => createInterpretationKnowledgeSnapshot(seed));
  expect(error).toMatchObject({
    code: "dependency_error",
    summary: "Interpretation-rules package is invalid.",
  });
  const valid = createValidInterpretationKnowledgeSeedPackage();
  const safeReferences = new Set([
    PACKAGE_REFERENCE,
    ...valid.sources.map((source) => source.sourceAlias),
    ...valid.entries.map((entry) => entry.entryId),
  ]);
  expect(error.affectedInputReferences.every((reference) => safeReferences.has(reference))).toBe(true);
}

describe("interpretation-rules-v1 knowledge snapshots", () => {
  it("exports only the runtime validator and public seed/snapshot types", () => {
    expect(knowledgeBase).toHaveProperty("createInterpretationKnowledgeSnapshot");
    expect(knowledgeBase).not.toHaveProperty("createInterpretationSeedPackage");
  });

  it("creates a defensive recursively frozen DeepReadonly clone", () => {
    expectTypeOf<InterpretationKnowledgeSnapshot>()
      .toEqualTypeOf<DeepReadonly<InterpretationKnowledgeSeedPackage>>();
    expectTypeOf<"push" extends keyof InterpretationKnowledgeSnapshot["entries"] ? true : false>()
      .toEqualTypeOf<false>();

    const seed = createValidInterpretationKnowledgeSeedPackage();
    const snapshot = createInterpretationKnowledgeSnapshot(seed);
    seed.entries[0]!.title = "changed after snapshot";
    seed.entries[1]!.relatedEntryIds.push("changed-after-snapshot");

    expect(snapshot.entries[0]!.title).toBe("Process capability index (Cpk)");
    expect(snapshot.entries[1]!.relatedEntryIds).toEqual(["metric-cpk"]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.entryTypeCounts)).toBe(true);
    expect(Object.isFrozen(snapshot.sources[0]!)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0]!.provenance)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[1]!.relatedEntryIds)).toBe(true);
    expect(() => Object.assign(snapshot.entries[0]!, { title: "mutated" })).toThrow(TypeError);
  });

  it("rejects schema-invalid input", () => {
    expectDependencyError({ manifest: {}, sources: [], entries: [], unexpected: true });
  });

  it("rejects the wrong package version", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.manifest.version = "interpretation-rules-v2" as "interpretation-rules-v1";
    expectDependencyError(seed);
  });

  it("rejects duplicate entry IDs", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.entries.push(structuredClone(seed.entries[0]!));
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("rejects duplicate source aliases", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.sources.push(structuredClone(seed.sources[0]!));
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it.each([
    ["missing source alias", (seed: InterpretationKnowledgeSeedPackage) => {
      seed.entries[0]!.provenance.sourceAlias = "missing-source";
    }],
    ["source file hash mismatch", (seed: InterpretationKnowledgeSeedPackage) => {
      seed.entries[0]!.provenance.sourceFileHash = "b".repeat(64);
    }],
  ])("rejects provenance with %s", (_description, mutate) => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    mutate(seed);
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it.each([
    ["source count", (seed: InterpretationKnowledgeSeedPackage) => { seed.manifest.sourceCount += 1; }],
    ["entry count", (seed: InterpretationKnowledgeSeedPackage) => { seed.manifest.entryCount += 1; }],
    ["entry type counts", (seed: InterpretationKnowledgeSeedPackage) => {
      seed.manifest.entryTypeCounts["metric-definition"] += 1;
    }],
    ["sources hash", (seed: InterpretationKnowledgeSeedPackage) => { seed.manifest.sourcesHash = "b".repeat(64); }],
    ["entries hash", (seed: InterpretationKnowledgeSeedPackage) => { seed.manifest.entriesHash = "b".repeat(64); }],
    ["content hash", (seed: InterpretationKnowledgeSeedPackage) => { seed.manifest.contentHash = "b".repeat(64); }],
  ])("rejects an incorrect manifest %s", (_description, mutate) => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    mutate(seed);
    expectDependencyError(seed);
  });

  it.each([
    ["missing Cpk fact", "cpk", ["cpk"]],
    ["extra Cpk fact", "cpk", ["cpk", "targetCpk", "contributors"]],
    ["duplicate Cpk fact", "cpk", ["cpk", "targetCpk", "cpk"]],
    ["missing sigma fact", "sigma", ["achievedSigma"]],
    ["extra sigma fact", "sigma", ["targetSigma", "achievedSigma", "contributors"]],
    ["duplicate sigma fact", "sigma", ["targetSigma", "achievedSigma", "targetSigma"]],
  ])("rejects performance requiredFacts with %s", (_description, metric, requiredFacts) => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const rule = seed.entries.find((entry) => entry.entryType === "performance-rule" && entry.metric === metric)!;
    rule.requiredFacts = requiredFacts;
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("accepts performance requiredFacts in either order", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    for (const entry of seed.entries) {
      if (entry.entryType === "performance-rule") entry.requiredFacts.reverse();
    }
    refreshInterpretationKnowledgeManifest(seed);
    expect(() => createInterpretationKnowledgeSnapshot(seed)).not.toThrow();
  });

  it.each([
    ["missing contributors", ["cpk"]],
    ["extra fact", ["contributors", "cpk"]],
  ])("rejects root-cause requiredFacts with %s", (_description, requiredFacts) => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const signal = seed.entries.find((entry) => entry.entryType === "root-cause-signal")!;
    signal.requiredFacts = requiredFacts;
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("rejects a bad manifest passed directly to the rules factory", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.manifest.entriesHash = "b".repeat(64);

    expect(getValidationError(() => createInterpretationRules(seed))).toMatchObject({
      code: "dependency_error",
      summary: "Interpretation-rules package is invalid.",
    });
  });

  it("rejects modified production entries when the released manifest is retained", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.entries[0]!.title = "tampered production entry";
    expectDependencyError(seed);
  });

  it("rejects an unknown related entry ID", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.entries[1]!.relatedEntryIds = ["missing-entry"];
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("rejects a self-reference", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.entries[1]!.relatedEntryIds = [seed.entries[1]!.entryId];
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("rejects a performance rule without a metric definition relation", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.entries[1]!.relatedEntryIds = [];
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("rejects a performance rule related to a metric definition for another metric", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.entries[1]!.relatedEntryIds = ["metric-sigma"];
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("rejects a performance rule related to two metric definitions", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const duplicateMetric = structuredClone(seed.entries[0]!);
    duplicateMetric.entryId = "metric-cpk-secondary";
    seed.entries.push(duplicateMetric);
    seed.entries[1]!.relatedEntryIds = ["metric-cpk", duplicateMetric.entryId];
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("requires every root-cause relation to reference a performance rule", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const signal = seed.entries.find((entry) => entry.entryType === "root-cause-signal")!;
    signal.relatedEntryIds = ["performance-cpk-below-target", "metric-cpk"];
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("requires root-cause signals and improvement options to have executable dependencies", () => {
    for (const entryType of ["root-cause-signal", "improvement-option"] as const) {
      const seed = createValidInterpretationKnowledgeSeedPackage();
      seed.entries.find((entry) => entry.entryType === entryType)!.relatedEntryIds = [];
      refreshInterpretationKnowledgeManifest(seed);
      expectDependencyError(seed);
    }
  });

  it.each([
    ["overlapping positive states", "greater-than-or-equal", "meets-target", "greater-than", "below-target", false],
    ["disjoint states", "greater-than-or-equal", "meets-target", "less-than", "below-target", true],
    ["overlapping zero boundary", "greater-than-or-equal", "meets-target", "less-than-or-equal", "below-target", false],
    ["overlap with the same outcome", "greater-than-or-equal", "meets-target", "greater-than", "meets-target", true],
  ] as const)("validates performance predicate outcomes for %s", (
    _description,
    firstComparison,
    firstOutcome,
    secondComparison,
    secondOutcome,
    accepted,
  ) => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const rules = seed.entries.filter((entry) => entry.entryType === "performance-rule" && entry.metric === "cpk");
    rules[0]!.comparison = firstComparison;
    rules[0]!.outcomeWhenMatched = firstOutcome;
    rules[1]!.comparison = secondComparison;
    rules[1]!.outcomeWhenMatched = secondOutcome;
    refreshInterpretationKnowledgeManifest(seed);

    const action = () => createInterpretationKnowledgeSnapshot(seed);
    if (accepted) expect(action).not.toThrow();
    else expectDependencyError(seed);
  });

  it.each([
    ["generic and rss", undefined, "rss", "greater-than", false],
    ["generic and worst-case", undefined, "worst-case", "greater-than", false],
    ["generic and generic", undefined, undefined, "greater-than", false],
    ["rss and worst-case", "rss", "worst-case", "greater-than", true],
    ["generic and rss with disjoint predicates", undefined, "rss", "less-than", true],
  ] as const)("validates performance method overlap for %s", (
    _description,
    firstMethod,
    secondMethod,
    secondComparison,
    accepted,
  ) => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const rules = seed.entries.filter((entry) => entry.entryType === "performance-rule" && entry.metric === "cpk");
    rules[0]!.applicability = firstMethod === undefined
      ? { analysisDimension: "one-dimensional" }
      : { analysisDimension: "one-dimensional", method: firstMethod };
    rules[0]!.comparison = "greater-than-or-equal";
    rules[0]!.outcomeWhenMatched = "meets-target";
    rules[1]!.applicability = secondMethod === undefined
      ? { analysisDimension: "one-dimensional" }
      : { analysisDimension: "one-dimensional", method: secondMethod };
    rules[1]!.comparison = secondComparison;
    rules[1]!.outcomeWhenMatched = "below-target";
    refreshInterpretationKnowledgeManifest(seed);

    const action = () => createInterpretationKnowledgeSnapshot(seed);
    if (accepted) expect(action).not.toThrow();
    else expectDependencyError(seed);
  });

  it("rejects a relation cycle", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const secondDecision = structuredClone(seed.entries[4]!);
    secondDecision.entryId = "decision-followup";
    secondDecision.relatedEntryIds = ["decision-escalate"];
    seed.entries[4]!.relatedEntryIds = ["decision-followup"];
    seed.entries.push(secondDecision);
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it.each([
    ["metric-definition to any entry", 0, "performance-cpk"],
    ["performance-rule to root-cause-signal", 1, "root-cause-contributor"],
    ["root-cause-signal to improvement-option", 2, "improvement-review"],
    ["improvement-option to metric-definition", 3, "metric-cpk"],
  ])("rejects the disallowed edge %s", (_description, sourceIndex, targetId) => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.entries[sourceIndex]!.relatedEntryIds = [targetId];
    refreshInterpretationKnowledgeManifest(seed);
    expectDependencyError(seed);
  });

  it("does not leak title, description, or source text through errors", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    seed.entries[1]!.relatedEntryIds = ["missing-entry"];
    seed.entries[1]!.title = "sensitive-title-marker";
    seed.entries[1]!.description = "sensitive-description-marker";
    seed.entries[1]!.provenance.changeSummary = "sensitive-source-text-marker";
    refreshInterpretationKnowledgeManifest(seed);

    const error = getValidationError(() => createInterpretationKnowledgeSnapshot(seed));
    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain("sensitive-title-marker");
    expect(serialized).not.toContain("sensitive-description-marker");
    expect(serialized).not.toContain("sensitive-source-text-marker");
    expect(error.affectedInputReferences).toEqual(["performance-cpk"]);
  });
});