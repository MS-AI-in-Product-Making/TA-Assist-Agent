import { describe, expect, expectTypeOf, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import * as knowledgeBase from "../index.js";
import {
  contentHash,
  createInternalKnowledgeSnapshot,
  type InternalKnowledgeSeedPackage,
  type InternalKnowledgeSnapshot,
} from "../index.js";
import { createInternalSeedPackage } from "./test-support.js";

type DeepReadonly<Value> = Value extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value;

const SAFE_REFERENCES = new Set([
  "internal-tolerance-guidance-manifest",
  "internal-tolerance-guidance-sources",
  "internal-tolerance-guidance-entries",
]);

function validPackage(): InternalKnowledgeSeedPackage {
  return createInternalSeedPackage();
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
    const parsed = typedErrorSchema.safeParse(error);
    expect(parsed.success).toBe(true);
    return error as {
      code: string;
      summary: string;
      message: string;
      affectedInputReferences: string[];
    };
  }
  throw new Error("Expected a validation error.");
}

function expectValidationError(action: () => unknown): void {
  const error = getValidationError(action);
  expect(error).toMatchObject({
    code: "validation_error",
    summary: "Internal tolerance-guidance package is invalid.",
  });
  expect(error.affectedInputReferences.every((reference) => SAFE_REFERENCES.has(reference))).toBe(true);
}

describe("internal-v1 tolerance-guidance seed package", () => {
  it("keeps internal fixture construction out of the package root API", () => {
    expect(knowledgeBase).not.toHaveProperty("createInternalSeedPackage");
  });

  it("creates mutable package copies with hashes and counts for anonymous internal fixtures", () => {
    const first = createInternalSeedPackage();
    const second = createInternalSeedPackage();

    expect(first.manifest).toMatchObject({
      contractVersion: "v1",
      knowledgeBaseVersion: "internal-v1",
      classification: "internal",
      sourceCount: first.sources.length,
      entryCount: first.entries.length,
    });
    expect(first.sources).toHaveLength(2);
    expect(first.entries).toHaveLength(4);
    expect(first.sources[0]!.sourceFile).not.toMatch(/\.xlsx?$/i);
    expect(first.manifest.sourcesContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.manifest.entriesContentHash).toMatch(/^[a-f0-9]{64}$/);

    first.entries[0]!.featureType = "changed-package-copy";
    expect(second.entries[0]!.featureType).not.toBe("changed-package-copy");
  });

  it("validates a package into a recursive frozen clone without changing the canonical seed", () => {
    expectTypeOf<InternalKnowledgeSnapshot>().toEqualTypeOf<DeepReadonly<InternalKnowledgeSeedPackage>>();
    expectTypeOf<InternalKnowledgeSnapshot["entries"]>()
      .toEqualTypeOf<readonly DeepReadonly<InternalKnowledgeSeedPackage["entries"][number]>[]>();
    expectTypeOf<InternalKnowledgeSnapshot["sources"]>()
      .toEqualTypeOf<readonly DeepReadonly<InternalKnowledgeSeedPackage["sources"][number]>[]>();
    expectTypeOf<InternalKnowledgeSnapshot["entries"][number]["provenance"]>()
      .toEqualTypeOf<DeepReadonly<InternalKnowledgeSeedPackage["entries"][number]["provenance"]>>();
    expectTypeOf<"push" extends keyof InternalKnowledgeSnapshot["entries"] ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<"push" extends keyof InternalKnowledgeSnapshot["sources"] ? true : false>().toEqualTypeOf<false>();

    const seed = validPackage();
    const snapshot = createInternalKnowledgeSnapshot(seed);
    seed.entries[0]!.featureType = "changed-after-snapshot";

    expect(snapshot.entries[0]!.featureType).not.toBe("changed-after-snapshot");
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest)).toBe(true);
    expect(Object.isFrozen(snapshot.sources)).toBe(true);
    expect(Object.isFrozen(snapshot.sources[0]!)).toBe(true);
    expect(Object.isFrozen(snapshot.entries)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0]!)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0]!.provenance)).toBe(true);
    expect(() => { Object.assign(snapshot.entries[0]!, { featureType: "mutated" }); }).toThrow(TypeError);
    expect(createInternalSeedPackage().entries[0]!.featureType).not.toBe("changed-after-snapshot");
  });

  it.each([
    ["entry", (seed: InternalKnowledgeSeedPackage) => seed.entries.push(structuredClone(seed.entries[0]!))],
    ["source", (seed: InternalKnowledgeSeedPackage) => seed.sources.push(structuredClone(seed.sources[0]!))],
  ])("rejects duplicate %s IDs", (_kind, mutate) => {
    const seed = validPackage();
    mutate(seed);
    expectValidationError(() => createInternalKnowledgeSnapshot(seed));
  });

  it.each([
    ["inverted nominal range", (seed: InternalKnowledgeSeedPackage) => {
      seed.entries[0]!.nominalRange = { min: 10, max: 1, unit: "mm" };
    }],
    ["zero maximum total band", (seed: InternalKnowledgeSeedPackage) => {
      seed.entries[0]!.maximumRecommendedTotalBand.value = 0;
    }],
    ["non-internal source classification", (seed: InternalKnowledgeSeedPackage) => {
      seed.sources[0]!.classification = "public" as "internal";
    }],
    ["non-internal entry provenance", (seed: InternalKnowledgeSeedPackage) => {
      seed.entries[0]!.provenance.classification = "public" as "internal";
    }],
  ])("rejects %s", (_description, mutate) => {
    const seed = validPackage();
    mutate(seed);
    expectValidationError(() => createInternalKnowledgeSnapshot(seed));
  });

  it.each([
    ["source file hash", (seed: InternalKnowledgeSeedPackage) => {
      seed.entries[0]!.provenance.sourceFileHash = "0".repeat(64);
    }],
    ["source range", (seed: InternalKnowledgeSeedPackage) => {
      seed.entries[0]!.provenance.sourceRange = "A2:H12";
    }],
  ])("rejects an entry provenance %s mismatch after the entries manifest hash is recomputed", (_description, mutate) => {
    const seed = validPackage();
    mutate(seed);
    seed.manifest.entriesContentHash = contentHash(seed.entries);

    expectValidationError(() => createInternalKnowledgeSnapshot(seed));
  });

  it.each([
    ["sources hash", (seed: InternalKnowledgeSeedPackage) => {
      seed.manifest.sourcesContentHash = "0".repeat(64);
    }],
    ["entries hash", (seed: InternalKnowledgeSeedPackage) => {
      seed.manifest.entriesContentHash = "0".repeat(64);
    }],
    ["source count", (seed: InternalKnowledgeSeedPackage) => {
      seed.manifest.sourceCount += 1;
    }],
    ["entry count", (seed: InternalKnowledgeSeedPackage) => {
      seed.manifest.entryCount += 1;
    }],
  ])("rejects an incorrect manifest %s", (_description, mutate) => {
    const seed = validPackage();
    mutate(seed);
    expectValidationError(() => createInternalKnowledgeSnapshot(seed));
  });

  it("rejects a fallback target that is absent", () => {
    const seed = validPackage();
    seed.entries[0]!.fallbackEntryId = "missing-entry";

    expectValidationError(() => createInternalKnowledgeSnapshot(seed));
  });

  it("rejects fallback cycles", () => {
    const seed = validPackage();
    seed.entries[0]!.fallbackEntryId = seed.entries[1]!.entryId;
    seed.entries[1]!.fallbackEntryId = seed.entries[0]!.entryId;

    expectValidationError(() => createInternalKnowledgeSnapshot(seed));
  });

  it("rejects equal-priority predicates whose process, feature, material, and nominal ranges overlap", () => {
    const seed = validPackage();
    const overlapping = structuredClone(seed.entries[0]!);
    overlapping.entryId = "internal-rule-overlap";
    overlapping.material = undefined;
    overlapping.nominalRange = { min: 5, max: 15, unit: "mm" };
    seed.entries.push(overlapping);

    expectValidationError(() => createInternalKnowledgeSnapshot(seed));
  });

  it("allows equal-priority nominal ranges that meet only at an excluded endpoint", () => {
    const seed = validPackage();
    const left = structuredClone(seed.entries[0]!);
    left.entryId = "internal-rule-up-to-six";
    left.material = undefined;
    left.nominalRange = { min: 3, minInclusive: false, max: 6, maxInclusive: true, unit: "mm" };
    const right = structuredClone(left);
    right.entryId = "internal-rule-over-six";
    right.nominalRange = { min: 6, minInclusive: false, max: 10, maxInclusive: true, unit: "mm" };
    seed.entries = [left, right];
    seed.manifest.entryCount = seed.entries.length;
    seed.manifest.entriesContentHash = contentHash(seed.entries);

    expect(createInternalKnowledgeSnapshot(seed).entries).toHaveLength(2);
  });

  it("allows equal-priority predicates with disjoint dimension-type conditions", () => {
    const seed = validPackage();
    const widthEntry = structuredClone(seed.entries[2]!);
    widthEntry.entryId = "internal-sheet-bend-width";
    widthEntry.conditions = { dimensionType: "W" };
    const nonWidthEntry = structuredClone(widthEntry);
    nonWidthEntry.entryId = "internal-sheet-bend-non-width";
    nonWidthEntry.conditions = { dimensionType: "NW" };
    seed.entries = [widthEntry, nonWidthEntry];
    seed.manifest.entryCount = seed.entries.length;
    seed.manifest.entriesContentHash = contentHash(seed.entries);

    expect(createInternalKnowledgeSnapshot(seed).entries).toHaveLength(2);
  });

  it("allows the same predicate when fallback priorities differ", () => {
    const seed = validPackage();

    expect(createInternalKnowledgeSnapshot(seed).entries).toHaveLength(4);
  });

  it("never leaks an internal source filename through validation errors", () => {
    const seed = validPackage();
    const sourceFile = "source-only-not-for-error.xlsx";
    seed.sources[0]!.sourceFile = sourceFile;

    const error = getValidationError(() => createInternalKnowledgeSnapshot(seed));
    expect(error.message).not.toContain(sourceFile);
    expect(error.affectedInputReferences.join(" ")).not.toContain(sourceFile);
    expect(error.affectedInputReferences.every((reference) => SAFE_REFERENCES.has(reference))).toBe(true);
  });
});