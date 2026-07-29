import { describe, expect, expectTypeOf, it } from "vitest";
import { typedErrorSchema, type InterpretationKnowledgeEntry } from "@ai-assist/contracts";
import * as knowledgeBase from "../index.js";
import {
  contentHash,
  createInterpretationKnowledgeSnapshot,
  type DeepReadonly,
  type InterpretationKnowledgeSeedPackage,
  type InterpretationKnowledgeSnapshot,
} from "../index.js";

const PACKAGE_REFERENCE = "interpretation-rules-v1";

function createValidPackage(): InterpretationKnowledgeSeedPackage {
  const source = {
    sourceAlias: "capability-handbook",
    sourceFileHash: "a".repeat(64),
    sourceVersion: "2026-Q3",
    classification: "internal" as const,
    owner: "knowledge-steward",
  };
  const provenance = {
    ...source,
    sheetName: "Rules",
    sourceRange: "A2:H20",
    confidence: 0.9,
    effectiveVersion: "interpretation-rules-v1" as const,
    changeSummary: "Initial reviewed interpretation rules.",
  };
  const common = {
    title: "Reviewed interpretation",
    description: "Reviewed internal interpretation guidance.",
    applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
    provenance,
  };
  const entries: InterpretationKnowledgeEntry[] = [
    {
      ...common,
      entryId: "metric-cpk",
      entryType: "metric-definition",
      relatedEntryIds: [],
      metric: "cpk",
      unit: "ratio",
    },
    {
      ...common,
      entryId: "performance-cpk",
      entryType: "performance-rule",
      relatedEntryIds: ["metric-cpk"],
      metric: "cpk",
      comparison: "greater-than-or-equal",
      targetSource: "resolved-target",
      requiredFacts: ["cpk", "targetCpk"],
      outcomeWhenMatched: "meets-target",
    },
    {
      ...common,
      entryId: "root-cause-contributor",
      entryType: "root-cause-signal",
      relatedEntryIds: ["performance-cpk", "metric-cpk"],
      signalStatus: "hypothesis",
      requiredFacts: ["contributors"],
      validationFacts: ["contributor-evidence"],
    },
    {
      ...common,
      entryId: "improvement-review",
      entryType: "improvement-option",
      relatedEntryIds: ["root-cause-contributor"],
      expectedImpact: "Reduce the largest contributor.",
      tradeoffs: ["May increase manufacturing cost."],
      validationSteps: ["Recalculate the tolerance stack."],
    },
    {
      ...common,
      entryId: "decision-escalate",
      entryType: "decision-policy",
      relatedEntryIds: [
        "metric-cpk",
        "performance-cpk",
        "root-cause-contributor",
        "improvement-review",
      ],
      policyKind: "engineering-review",
    },
  ];
  const seed: InterpretationKnowledgeSeedPackage = {
    manifest: {
      version: "interpretation-rules-v1",
      classification: "internal",
      sourceCount: 1,
      entryCount: entries.length,
      entryTypeCounts: {
        "metric-definition": 1,
        "performance-rule": 1,
        "root-cause-signal": 1,
        "improvement-option": 1,
        "decision-policy": 1,
      },
      sourcesHash: "0".repeat(64),
      entriesHash: "0".repeat(64),
      contentHash: "0".repeat(64),
    },
    sources: [source],
    entries,
  };
  refreshManifest(seed);
  return seed;
}

function refreshManifest(seed: InterpretationKnowledgeSeedPackage): void {
  seed.manifest.sourceCount = seed.sources.length;
  seed.manifest.entryCount = seed.entries.length;
  seed.manifest.entryTypeCounts = {
    "metric-definition": seed.entries.filter((entry) => entry.entryType === "metric-definition").length,
    "performance-rule": seed.entries.filter((entry) => entry.entryType === "performance-rule").length,
    "root-cause-signal": seed.entries.filter((entry) => entry.entryType === "root-cause-signal").length,
    "improvement-option": seed.entries.filter((entry) => entry.entryType === "improvement-option").length,
    "decision-policy": seed.entries.filter((entry) => entry.entryType === "decision-policy").length,
  };
  seed.manifest.sourcesHash = contentHash(seed.sources);
  seed.manifest.entriesHash = contentHash(seed.entries);
  seed.manifest.contentHash = contentHash({
    version: seed.manifest.version,
    sourcesHash: seed.manifest.sourcesHash,
    entriesHash: seed.manifest.entriesHash,
  });
}

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

function expectValidationError(seed: unknown): void {
  const error = getValidationError(() => createInterpretationKnowledgeSnapshot(seed));
  expect(error).toMatchObject({
    code: "validation_error",
    summary: "Interpretation-rules package is invalid.",
  });
  const valid = createValidPackage();
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

    const seed = createValidPackage();
    const snapshot = createInterpretationKnowledgeSnapshot(seed);
    seed.entries[0]!.title = "changed after snapshot";
    seed.entries[1]!.relatedEntryIds.push("changed-after-snapshot");

    expect(snapshot.entries[0]!.title).toBe("Reviewed interpretation");
    expect(snapshot.entries[1]!.relatedEntryIds).toEqual(["metric-cpk"]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.entryTypeCounts)).toBe(true);
    expect(Object.isFrozen(snapshot.sources[0]!)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0]!.provenance)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[1]!.relatedEntryIds)).toBe(true);
    expect(() => Object.assign(snapshot.entries[0]!, { title: "mutated" })).toThrow(TypeError);
  });

  it("rejects schema-invalid input", () => {
    expectValidationError({ manifest: {}, sources: [], entries: [], unexpected: true });
  });

  it("rejects the wrong package version", () => {
    const seed = createValidPackage();
    seed.manifest.version = "interpretation-rules-v2" as "interpretation-rules-v1";
    expectValidationError(seed);
  });

  it("rejects duplicate entry IDs", () => {
    const seed = createValidPackage();
    seed.entries.push(structuredClone(seed.entries[0]!));
    refreshManifest(seed);
    expectValidationError(seed);
  });

  it("rejects duplicate source aliases", () => {
    const seed = createValidPackage();
    seed.sources.push(structuredClone(seed.sources[0]!));
    refreshManifest(seed);
    expectValidationError(seed);
  });

  it.each([
    ["missing source alias", (seed: InterpretationKnowledgeSeedPackage) => {
      seed.entries[0]!.provenance.sourceAlias = "missing-source";
    }],
    ["source file hash mismatch", (seed: InterpretationKnowledgeSeedPackage) => {
      seed.entries[0]!.provenance.sourceFileHash = "b".repeat(64);
    }],
  ])("rejects provenance with %s", (_description, mutate) => {
    const seed = createValidPackage();
    mutate(seed);
    refreshManifest(seed);
    expectValidationError(seed);
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
    const seed = createValidPackage();
    mutate(seed);
    expectValidationError(seed);
  });

  it("rejects an unknown related entry ID", () => {
    const seed = createValidPackage();
    seed.entries[1]!.relatedEntryIds = ["missing-entry"];
    refreshManifest(seed);
    expectValidationError(seed);
  });

  it("rejects a self-reference", () => {
    const seed = createValidPackage();
    seed.entries[1]!.relatedEntryIds = [seed.entries[1]!.entryId];
    refreshManifest(seed);
    expectValidationError(seed);
  });

  it("rejects a relation cycle", () => {
    const seed = createValidPackage();
    const secondDecision = structuredClone(seed.entries[4]!);
    secondDecision.entryId = "decision-followup";
    secondDecision.relatedEntryIds = ["decision-escalate"];
    seed.entries[4]!.relatedEntryIds = ["decision-followup"];
    seed.entries.push(secondDecision);
    refreshManifest(seed);
    expectValidationError(seed);
  });

  it.each([
    ["metric-definition to any entry", 0, "performance-cpk"],
    ["performance-rule to root-cause-signal", 1, "root-cause-contributor"],
    ["root-cause-signal to improvement-option", 2, "improvement-review"],
    ["improvement-option to metric-definition", 3, "metric-cpk"],
  ])("rejects the disallowed edge %s", (_description, sourceIndex, targetId) => {
    const seed = createValidPackage();
    seed.entries[sourceIndex]!.relatedEntryIds = [targetId];
    refreshManifest(seed);
    expectValidationError(seed);
  });

  it("does not leak title, description, or source text through errors", () => {
    const seed = createValidPackage();
    seed.entries[1]!.relatedEntryIds = ["missing-entry"];
    seed.entries[1]!.title = "sensitive-title-marker";
    seed.entries[1]!.description = "sensitive-description-marker";
    seed.entries[1]!.provenance.changeSummary = "sensitive-source-text-marker";
    refreshManifest(seed);

    const error = getValidationError(() => createInterpretationKnowledgeSnapshot(seed));
    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain("sensitive-title-marker");
    expect(serialized).not.toContain("sensitive-description-marker");
    expect(serialized).not.toContain("sensitive-source-text-marker");
    expect(error.affectedInputReferences).toEqual(["performance-cpk"]);
  });
});