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