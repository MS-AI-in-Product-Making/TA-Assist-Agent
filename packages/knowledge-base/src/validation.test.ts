import { describe, expect, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import { createCanonicalSeedData } from "./data/v1.js";
import {
  canonicalJson,
  contentHash,
  createKnowledgeSnapshot,
  createSeedPackage,
  type KnowledgeBaseSeedPackage,
} from "./index.js";

const SAFE_INPUT_REFERENCES = new Set([
  "capability-library",
  "engineering-rules",
  "terminology-ontology",
  "knowledge-base-manifest",
]);

function validPackage(): KnowledgeBaseSeedPackage {
  return createSeedPackage();
}

function expectValidationError(action: () => unknown): void {
  expect(action).toThrowError(
    expect.objectContaining({
      code: "validation_error",
      summary: "Knowledge-base package is invalid.",
    }),
  );
}

function getValidationError(action: () => unknown): {
  code: string;
  summary: string;
  affectedInputReferences: string[];
} {
  try {
    action();
  } catch (error) {
    return error as {
      code: string;
      summary: string;
      affectedInputReferences: string[];
    };
  }
  throw new Error("Expected a validation error.");
}

function expectSafeTypedValidationError(action: () => unknown, rawMarker: string): void {
  const error = getValidationError(action);

  expect(typedErrorSchema.safeParse(error).success).toBe(true);
  expect(error).toMatchObject({
    code: "validation_error",
    summary: "Knowledge-base package is invalid.",
  });
  expect(error.message).not.toContain(rawMarker);
  expect(error.affectedInputReferences.join(" ")).not.toContain(rawMarker);
  expect(error.affectedInputReferences.every((reference) => SAFE_INPUT_REFERENCES.has(reference))).toBe(true);
}

function expectRedactedValidationError(rawMarker: string): void {
  const seed = validPackage();
  const rawSource = `${rawMarker} caller-controlled source`;
  seed.capabilities[0]!.provenance.source = rawSource;

  const error = getValidationError(() => createKnowledgeSnapshot(seed));
  const affectedReferences = error.affectedInputReferences.join(" ");

  expect(error).toMatchObject({
    code: "validation_error",
    summary: "Knowledge-base package is invalid.",
  });
  expect(error.message).not.toContain(rawMarker);
  expect(error.message).not.toContain(rawSource);
  expect(affectedReferences).not.toContain(rawMarker);
  expect(affectedReferences).not.toContain(rawSource);
  expect(error.affectedInputReferences.every((reference) => SAFE_INPUT_REFERENCES.has(reference))).toBe(true);
}

describe("knowledge-base v1 seed package", () => {
  it("creates the exact required public seed payloads", () => {
    const seed = createSeedPackage();

    expect(seed.capabilities).toEqual([
      expect.objectContaining({
        entryId: "cap-demo-bracket",
        partCategory: "demo-bracket",
        toleranceMin: 0.1,
        toleranceMax: 0.3,
        unit: "mm",
        recommendedDistribution: "normal",
        capabilityTier: "T3",
      }),
      expect.objectContaining({
        entryId: "cap-demo-spacer",
        partCategory: "demo-spacer",
        toleranceMin: 0.05,
        toleranceMax: 0.2,
        unit: "mm",
        recommendedDistribution: "uniform",
        capabilityTier: "T3",
      }),
    ]);
    expect(seed.rules.map(({ ruleId, ruleType, threshold }) => ({ ruleId, ruleType, threshold }))).toEqual([
      { ruleId: "cts-sigma", ruleType: "sigma", threshold: 6 },
      { ruleId: "ctf-sigma", ruleType: "sigma", threshold: 4 },
      { ruleId: "default-cpk-target", ruleType: "cpk", threshold: 1.33 },
    ]);
    expect(seed.terminology.map(({ entryId, parentEntryId }) => ({ entryId, parentEntryId }))).toEqual([
      { entryId: "demo-bracket", parentEntryId: undefined },
      { entryId: "mechanical-demo", parentEntryId: undefined },
      { entryId: "primary-demo-datum", parentEntryId: "mechanical-demo" },
    ]);
  });

  it("creates a valid immutable public v1 snapshot", () => {
    const snapshot = createKnowledgeSnapshot(validPackage());

    expect(snapshot.manifest).toMatchObject({
      contractVersion: "v1",
      knowledgeBaseVersion: "v1",
      classification: "public",
      releasedAt: "2026-07-22",
    });
    expect(snapshot.capabilities).toHaveLength(2);
    expect(snapshot.rules).toHaveLength(3);
    expect(snapshot.terminology).toHaveLength(3);
  });

  it("uses canonical object-key ordering and lower-case SHA-256 hashes", () => {
    expect(canonicalJson({ b: 2, a: ["first", { y: true, x: null }] })).toBe(
      '{"a":["first",{"x":null,"y":true}],"b":2}',
    );
    expect(canonicalJson({ "\u03a9": 1, "\u00e4": 2, a: 3, Z: 4 })).toBe(
      '{"Z":4,"a":3,"\u00e4":2,"\u03a9":1}',
    );
    expect(contentHash({ b: 2, a: ["first", { y: true, x: null }] })).toBe(
      contentHash({ a: ["first", { x: null, y: true }], b: 2 }),
    );
    expect(contentHash(validPackage().capabilities)).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["canonicalJson", (value: unknown) => canonicalJson(value)],
    ["contentHash", (value: unknown) => contentHash(value)],
  ])("fails closed when %s receives throwing or cyclic public input", (_name, invoke) => {
    const rawMarker = "raw-hostile-marker";
    const throwingGetter = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => { throw new Error(rawMarker); },
    });
    const throwingProxy = new Proxy({}, {
      ownKeys: () => { throw new Error(rawMarker); },
    });
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    for (const value of [throwingGetter, throwingProxy, cyclic]) {
      expectSafeTypedValidationError(() => invoke(value), rawMarker);
    }
  });

  it("rejects a duplicate capability stable ID", () => {
    const seed = validPackage();
    seed.capabilities.push(structuredClone(seed.capabilities[0]!));

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects a duplicate terminology stable ID", () => {
    const seed = validPackage();
    seed.terminology.push(structuredClone(seed.terminology[0]!));

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects a duplicate rule ID", () => {
    const seed = validPackage();
    seed.rules.push(structuredClone(seed.rules[0]!));

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects an inverted tolerance range", () => {
    const seed = validPackage();
    seed.capabilities[0]!.toleranceMin = seed.capabilities[0]!.toleranceMax + 0.01;

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects an invalid recommended distribution", () => {
    const seed = validPackage();
    seed.capabilities[0]!.recommendedDistribution = "unsupported" as "normal";

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it.each([
    ["non-public classification", ["inter", "nal"].join("")],
    ["restricted classification", ["se", "cret"].join("")],
  ])("rejects a %s", (_description, classification) => {
    const seed = validPackage();
    seed.manifest.classification = classification as "public";

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects malformed public schema input with the typed validation summary", () => {
    const seed = validPackage() as unknown as { capabilities: Array<Record<string, unknown>> };
    delete seed.capabilities[0]!.partCategory;

    const error = getValidationError(() => createKnowledgeSnapshot(seed));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Knowledge-base package is invalid.",
    });
  });

  it("rejects a manifest hash mismatch", () => {
    const seed = validPackage();
    seed.manifest.libraries[0]!.contentHash = "0".repeat(64);

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects a manifest missing a required library", () => {
    const seed = validPackage();
    seed.manifest.libraries = seed.manifest.libraries.filter(
      (library) => library.libraryId !== "terminology-ontology",
    );

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it.each([
    ["incorrect library ID", (seed: KnowledgeBaseSeedPackage) => {
      seed.manifest.libraries[0]!.libraryId = "untrusted-library" as "capability-library";
    }],
    ["incorrect entry count", (seed: KnowledgeBaseSeedPackage) => {
      seed.manifest.libraries[0]!.entryCount += 1;
    }],
    ["incorrect contract ID", (seed: KnowledgeBaseSeedPackage) => {
      seed.manifest.libraries[0]!.contractId = "untrusted-contract" as "capability-library-v1";
    }],
  ])("rejects a manifest with an %s", (_description, mutate) => {
    const seed = validPackage();
    mutate(seed);

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects a manifest v1 package with v2 entry provenance", () => {
    const seed = validPackage();
    seed.rules[0]!.provenance.effectiveVersion = ["v", "2"].join("") as "v1";

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects an unknown terminology parent", () => {
    const seed = validPackage();
    seed.terminology[0]!.parentEntryId = "missing-parent";

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects a terminology cycle", () => {
    const seed = validPackage();
    seed.terminology[0]!.parentEntryId = seed.terminology[1]!.entryId;
    seed.terminology[1]!.parentEntryId = seed.terminology[0]!.entryId;

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects a same-type canonical and alias conflict", () => {
    const seed = validPackage();
    seed.terminology[0]!.aliases.push(seed.terminology[0]!.canonicalName.toUpperCase());

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects a case-insensitive cross-entry canonical and alias conflict within a term type", () => {
    const seed = validPackage();
    const duplicate = structuredClone(seed.terminology[0]!);
    duplicate.entryId = "untrusted-term-id";
    duplicate.canonicalName = "unique canonical name";
    duplicate.aliases = [seed.terminology[0]!.canonicalName.toUpperCase()];
    seed.terminology.push(duplicate);

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("rejects a non-ASCII case-insensitive terminology alias collision", () => {
    const seed = validPackage();
    seed.terminology[0]!.aliases.push("\u00c4LIASE");
    seed.terminology[0]!.aliases.push("\u00e4liase");

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it.each([
    [[".xls", "x"].join("")],
    [[".xls", "m"].join("")],
    [["DIM", " ID"].join("")],
    [["sup", "plier"].join("")],
    [["se", "cret"].join("")],
    [["project", " code"].join("")],
    [["confiden", "tial"].join("")],
  ])("rejects and redacts a banned marker", (marker) => {
    expectRedactedValidationError(marker);
  });

  it("rejects and redacts runtime-constructed internal provenance text", () => {
    const seed = validPackage();
    const rawMarker = ["InTeR", "NaL"].join("");
    const rawSource = `${rawMarker} caller-controlled source`;
    seed.capabilities[0]!.provenance.source = rawSource;
    seed.manifest.libraries[0]!.contentHash = contentHash(seed.capabilities);

    const error = getValidationError(() => createKnowledgeSnapshot(seed));
    const affectedReferences = error.affectedInputReferences.join(" ");

    expect(error.code).toBe("validation_error");
    expect(error.summary).toBe("Knowledge-base package is invalid.");
    expect(error.message).not.toContain(rawMarker);
    expect(error.message).not.toContain(rawSource);
    expect(affectedReferences).not.toContain(rawMarker);
    expect(affectedReferences).not.toContain(rawSource);
    expect(error.affectedInputReferences.every((reference) => SAFE_INPUT_REFERENCES.has(reference))).toBe(true);
  });

  it("returns only fixed safe references for invalid caller-controlled IDs and values", () => {
    const seed = validPackage();
    const untrustedId = "caller-controlled-entry-id";
    const sensitiveText = "private customer note";
    const duplicate = structuredClone(seed.terminology[0]!);
    duplicate.entryId = untrustedId;
    duplicate.aliases = [sensitiveText];
    seed.terminology.push(duplicate);

    const error = getValidationError(() => createKnowledgeSnapshot(seed));

    expect(error.affectedInputReferences).not.toContain(untrustedId);
    expect(error.affectedInputReferences).not.toContain(sensitiveText);
    expect(error.affectedInputReferences.every((reference) => SAFE_INPUT_REFERENCES.has(reference))).toBe(true);
  });

  it("rejects cyclic caller-controlled input with the typed safe validation error", () => {
    const seed = validPackage() as KnowledgeBaseSeedPackage & { cycle?: unknown };
    seed.cycle = seed;

    const error = getValidationError(() => createKnowledgeSnapshot(seed));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Knowledge-base package is invalid.",
    });
    expect(error.message).not.toContain("cycle");
  });

  it("fails closed for throwing or cyclic createKnowledgeSnapshot input", () => {
    const rawMarker = "raw-snapshot-marker";
    const throwingGetter = Object.defineProperty({}, "manifest", {
      enumerable: true,
      get: () => { throw new Error(rawMarker); },
    });
    const throwingProxy = new Proxy({}, {
      get: () => { throw new Error(rawMarker); },
    });
    const cyclic: { manifest?: unknown; capabilities?: unknown[]; rules?: unknown[]; terminology?: unknown[] } = {
      capabilities: [],
      rules: [],
      terminology: [],
    };
    cyclic.manifest = cyclic;

    for (const value of [throwingGetter, throwingProxy, cyclic]) {
      expectSafeTypedValidationError(() => createKnowledgeSnapshot(value), rawMarker);
    }
  });

  it("rejects extra root seed package properties", () => {
    const seed = validPackage() as KnowledgeBaseSeedPackage & { extra: string };
    seed.extra = "not part of the seed contract";

    expectValidationError(() => createKnowledgeSnapshot(seed));
  });

  it("clones seed data and recursively freezes validated snapshots", () => {
    const seed = validPackage();
    const snapshot = createKnowledgeSnapshot(seed);
    seed.capabilities[0]!.partCategory = "changed-after-snapshot";

    expect(snapshot.capabilities[0]!.partCategory).toBe("demo-bracket");
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.capabilities)).toBe(true);
    expect(Object.isFrozen(snapshot.capabilities[0]!)).toBe(true);
    expect(() => {
      (snapshot.capabilities as unknown as { push: (value: unknown) => void }).push({});
    }).toThrow();
  });

  it("keeps frozen canonical seed data immutable and created packages canonical", () => {
    const canonical = createCanonicalSeedData();

    expect(Object.isFrozen(canonical.capabilities)).toBe(true);
    expect(Object.isFrozen(canonical.capabilities[0]!)).toBe(true);
    expect(() => {
      (canonical.capabilities[0] as { toleranceMin: number }).toleranceMin = 99;
    }).toThrow();

    const seed = validPackage();
    expect(seed.capabilities[0]!.toleranceMin).toBe(0.1);
    expect(seed.capabilities[0]!.toleranceMax).toBe(0.3);
  });
});