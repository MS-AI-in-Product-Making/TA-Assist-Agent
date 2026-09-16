import { describe, expect, expectTypeOf, it } from "vitest";
import {
  typedErrorSchema,
  type ProcessRequirementSeedPackage,
} from "@ai-assist/contracts";
import type { DeepReadonly, ProcessRequirementSnapshot } from "./types.js";
import { createProcessRequirementSnapshot } from "./validation.js";
import {
  createValidProcessRequirementSeedPackage,
  refreshProcessRequirementManifest,
} from "./test-support.js";

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
  const error = getValidationError(() => createProcessRequirementSnapshot(seed));
  expect(error).toMatchObject({
    code: "validation_error",
    summary: "Process-requirements package is invalid.",
  });
}

function useApprovedTranscription(seed: ProcessRequirementSeedPackage): void {
  const hash = "c".repeat(64);
  seed.manifest.version = "process-requirements-v3";
  seed.sources.push({
    sourceType: "approved-transcription",
    sourceAlias: "approved-priority-guidance",
    hash,
    revision: "user-approved-2026-09-16",
    section: "priority-definitions",
    sourceClassification: "confidential",
    releasedClassification: "internal",
    owner: "Dimensional Management",
    reviewedAt: "2026-09-16T00:00:00.000Z",
  });
  seed.entries[0]!.provenance = {
    sourceType: "approved-transcription",
    sourceAlias: "approved-priority-guidance",
    sourceContentHash: hash,
    sourceRevision: "user-approved-2026-09-16",
    section: "priority-definitions.p0",
    effectiveVersion: "process-requirements-v3",
    owner: "Dimensional Management",
    confidence: "reviewed",
    changeSummary: "Add approved P0 priority guidance.",
  };
  for (const entry of seed.entries.slice(1)) {
    entry.provenance.effectiveVersion = "process-requirements-v3";
  }
  refreshProcessRequirementManifest(seed);
}

describe("F0 process requirement snapshots", () => {
  it("creates a defensive recursively frozen DeepReadonly clone", () => {
    expectTypeOf<ProcessRequirementSnapshot>()
      .toEqualTypeOf<DeepReadonly<ProcessRequirementSeedPackage>>();
    expectTypeOf<"push" extends keyof ProcessRequirementSnapshot["entries"] ? true : false>()
      .toEqualTypeOf<false>();

    const seed = createValidProcessRequirementSeedPackage();
    const snapshot = createProcessRequirementSnapshot(seed);
    seed.entries[0]!.title = "changed after snapshot";
    seed.entries[0]!.relatedEntryIds.push("changed-after-snapshot");

    expect(snapshot.entries[0]!.title).toBe("requirement example");
    expect(snapshot.entries[0]!.relatedEntryIds).toEqual(["warning-review"]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.counts.entryTypes)).toBe(true);
    expect(Object.isFrozen(snapshot.sources[0]!)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0]!.provenance)).toBe(true);
    expect(Object.isFrozen(snapshot.entries[0]!.relatedEntryIds)).toBe(true);
    expect(() => Object.assign(snapshot.entries[0]!, { title: "mutated" })).toThrow(TypeError);
  });

  it("rejects schema-invalid input with a typed validation error", () => {
    expectValidationError({ manifest: {}, sources: [], entries: [], unexpected: true });
  });

  it("rejects duplicate entry IDs", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries.push(structuredClone(seed.entries[0]!));
    refreshProcessRequirementManifest(seed);
    expectValidationError(seed);
  });

  it("rejects duplicate source aliases", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.sources.push(structuredClone(seed.sources[0]!));
    refreshProcessRequirementManifest(seed);
    expectValidationError(seed);
  });

  it.each([
    ["source count", (seed: ProcessRequirementSeedPackage) => { seed.manifest.counts.sources += 1; }],
    ["entry count", (seed: ProcessRequirementSeedPackage) => { seed.manifest.counts.entries += 1; }],
    ["entry type counts", (seed: ProcessRequirementSeedPackage) => {
      seed.manifest.counts.entryTypes.requirement += 1;
    }],
    ["sources hash", (seed: ProcessRequirementSeedPackage) => { seed.manifest.sourcesHash = "b".repeat(64); }],
    ["entries hash", (seed: ProcessRequirementSeedPackage) => { seed.manifest.entriesHash = "b".repeat(64); }],
    ["content hash", (seed: ProcessRequirementSeedPackage) => { seed.manifest.contentHash = "b".repeat(64); }],
  ])("rejects an incorrect manifest %s", (_description, mutate) => {
    const seed = createValidProcessRequirementSeedPackage();
    mutate(seed);
    expectValidationError(seed);
  });

  it.each([
    ["unknown source alias", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.provenance.sourceAlias = "missing-source";
    }],
    ["source hash mismatch", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.provenance.sourceFileHash = "b".repeat(64);
    }],
    ["source revision mismatch", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.provenance.sourceRevision = "RC";
    }],
    ["source sheet mismatch", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.provenance.sheetName = "Other Sheet";
    }],
  ])("rejects provenance with %s", (_description, mutate) => {
    const seed = createValidProcessRequirementSeedPackage();
    mutate(seed);
    refreshProcessRequirementManifest(seed);
    expectValidationError(seed);
  });

  it("accepts an entry source range contained by the registered source range", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.provenance.sourceRange = "B7:B9";
    refreshProcessRequirementManifest(seed);

    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it("rejects an entry source range outside the registered source range", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.provenance.sourceRange = "A1:B9";
    refreshProcessRequirementManifest(seed);

    expectValidationError(seed);
  });

  it("rejects a reversed entry source range", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.provenance.sourceRange = "T55:B7";
    refreshProcessRequirementManifest(seed);

    expectValidationError(seed);
  });

  it("rejects a missing related entry", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.relatedEntryIds = ["missing-entry"];
    refreshProcessRequirementManifest(seed);
    expectValidationError(seed);
  });

  it("rejects a self-reference", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.relatedEntryIds = [seed.entries[0]!.entryId];
    refreshProcessRequirementManifest(seed);
    expectValidationError(seed);
  });

  it("rejects a multi-entry relation cycle", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[1]!.relatedEntryIds = ["requirement-scope"];
    refreshProcessRequirementManifest(seed);
    expectValidationError(seed);
  });

  it("rejects conditional applicability without required facts", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.applicability = {
      analysisMethod: "one-dimensional-rss",
      requiredFacts: [],
    };
    refreshProcessRequirementManifest(seed);

    const error = getValidationError(() => createProcessRequirementSnapshot(seed));
    expect(error).toMatchObject({
      code: "validation_error",
      affectedInputReferences: ["process-requirements-entries"],
    });
    expect(JSON.stringify(error)).not.toContain("one-dimensional-rss");
  });

  it("rejects applicability predicates omitted from required facts", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.applicability = {
      actor: "odm",
      requiredFacts: ["priority"],
    };
    refreshProcessRequirementManifest(seed);

    const error = getValidationError(() => createProcessRequirementSnapshot(seed));
    expect(error).toMatchObject({
      code: "validation_error",
      affectedInputReferences: ["process-requirements-entries"],
    });
    expect(JSON.stringify(error)).not.toContain("odm");
  });

  it("maps the minimum tolerance predicate to the toleranceCount required fact", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.applicability = {
      minimumToleranceCountExclusive: 1,
      requiredFacts: ["priority"],
    };
    refreshProcessRequirementManifest(seed);

    expectValidationError(seed);
  });

  it("maps the maximum tolerance predicate to the toleranceCount required fact", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.applicability = {
      maximumToleranceCountExclusive: 4,
      requiredFacts: ["priority"],
    };
    refreshProcessRequirementManifest(seed);

    expectValidationError(seed);
  });

  it("accepts the maximum tolerance predicate with the toleranceCount required fact", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.applicability = {
      maximumToleranceCountExclusive: 4,
      requiredFacts: ["toleranceCount"],
    };
    refreshProcessRequirementManifest(seed);

    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it("maps the component category predicate to the componentCategories required fact", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.applicability = {
      componentCategory: "battery-cts",
      requiredFacts: ["priority"],
    };
    refreshProcessRequirementManifest(seed);

    expectValidationError(seed);
  });

  it("rejects a recommended priority without a governed component category predicate", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.topic = "priority";
    seed.entries[0]!.recommendedPriority = "P0";
    refreshProcessRequirementManifest(seed);

    expectValidationError(seed);
  });

  it("rejects duplicate priority mappings for the same component category", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.manifest.version = "process-requirements-v3";
    for (const entry of seed.entries) entry.provenance.effectiveVersion = "process-requirements-v3";
    seed.entries[0]!.topic = "priority";
    seed.entries[0]!.recommendedPriority = "P0";
    seed.entries[0]!.applicability = {
      componentCategory: "battery-cts",
      requiredFacts: ["componentCategories"],
    };
    const duplicate = structuredClone(seed.entries[0]!);
    duplicate.entryId = "duplicate-priority-mapping";
    duplicate.recommendedPriority = "P1";
    duplicate.relatedEntryIds = [];
    seed.entries.push(duplicate);
    refreshProcessRequirementManifest(seed);

    expectValidationError(seed);
  });

  it("accepts approved-transcription provenance contained by its registered section", () => {
    const seed = createValidProcessRequirementSeedPackage();
    useApprovedTranscription(seed);

    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it.each([
    ["content hash", (seed: ProcessRequirementSeedPackage) => {
      if (seed.entries[0]!.provenance.sourceType === "approved-transcription") {
        seed.entries[0]!.provenance.sourceContentHash = "d".repeat(64);
      }
    }],
    ["section", (seed: ProcessRequirementSeedPackage) => {
      if (seed.entries[0]!.provenance.sourceType === "approved-transcription") {
        seed.entries[0]!.provenance.section = "other-guidance.p0";
      }
    }],
  ])("rejects approved-transcription provenance with mismatched %s", (_description, mutate) => {
    const seed = createValidProcessRequirementSeedPackage();
    useApprovedTranscription(seed);
    mutate(seed);
    refreshProcessRequirementManifest(seed);

    expectValidationError(seed);
  });

  it.each([
    [3, 4],
    [4, 4],
    [5, 4],
  ])(
    "rejects minimum tolerance count %s with maximum tolerance count %s",
    (minimumToleranceCountExclusive, maximumToleranceCountExclusive) => {
      const seed = createValidProcessRequirementSeedPackage();
      seed.entries[0]!.applicability = {
        minimumToleranceCountExclusive,
        maximumToleranceCountExclusive,
        requiredFacts: ["toleranceCount"],
      };
      refreshProcessRequirementManifest(seed);

      expectValidationError(seed);
    },
  );

  it("accepts an unconditional informational definition without required facts", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[1]!.entryType = "definition";
    seed.entries[1]!.normativeStrength = "informational";
    seed.entries[1]!.applicability = { requiredFacts: [] };
    refreshProcessRequirementManifest(seed);

    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it.each([
    ["absolute Windows path", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.provenance.changeSummary = "C:\\controlled\\source.xlsx";
    }],
    ["root-relative Windows path", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.provenance.changeSummary = "\\controlled\\source.xlsx";
    }],
    ["embedded absolute Windows path", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.provenance.changeSummary = "prefix=C:\\controlled\\source.xlsx";
    }],
    ["absolute Unix path", (seed: ProcessRequirementSeedPackage) => {
      seed.manifest.changeSummary = "/srv/controlled/source.xlsx";
    }],
    ["embedded absolute Unix path", (seed: ProcessRequirementSeedPackage) => {
      seed.manifest.changeSummary = "prefix=/srv/controlled/source.xlsx";
    }],
    ["file URL", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "file:///srv/controlled/source.xlsx";
    }],
    ["malformed file URL", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "file:/srv/source.xlsx";
    }],
    ["HTTP URL", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "https://example.test/controlled/source";
    }],
    ["malformed HTTP URL", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "http:/example.test/source";
    }],
    ["FTP URL", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "ftp://example.test/controlled/source";
    }],
    ["protocol-relative URL", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "//example.test/controlled/source";
    }],
    ["relative file URL", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "file:relative.xlsx";
    }],
    ["HTTP URL without slashes", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "https:example.test/source";
    }],
    ["bare www URL", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "www.example.test/confidential";
    }],
    ["workbook filename", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "controlled-template.xlsx";
    }],
    ["multi-dot workbook filename", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "TA.v2.xlsx";
    }],
    ["Markdown-linked workbook filename", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "[controlled-template.xlsx]";
    }],
    ["workbook filename before a colon", (seed: ProcessRequirementSeedPackage) => {
      seed.entries[0]!.message = "controlled-template.xlsx: restricted";
    }],
  ])("recursively rejects %s leakage", (_description, mutate) => {
    const seed = createValidProcessRequirementSeedPackage();
    mutate(seed);
    refreshProcessRequirementManifest(seed);
    expectValidationError(seed);
  });

  it.each([
    "See input / output guidance.",
    "Use and/or only when the source permits either option.",
  ])("accepts ordinary slash text: %s", (message) => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.message = message;
    refreshProcessRequirementManifest(seed);

    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it("accepts generic workbook extension guidance without a filename", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.message = "Supported formats: .xlsx and .xlsm";
    refreshProcessRequirementManifest(seed);

    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it.each(["sourceText", "rawText", "verbatim"])(
    "recursively rejects the forbidden property name %s",
    (propertyName) => {
      const seed = createValidProcessRequirementSeedPackage();
      Object.assign(seed.entries[0]!.applicability, { [propertyName]: "sensitive marker" });
      expectValidationError(seed);
    },
  );

  it("does not expose untrusted input in validation error summaries or references", () => {
    const seed = createValidProcessRequirementSeedPackage();
    seed.entries[0]!.relatedEntryIds = ["sensitive-missing-entry-marker"];
    refreshProcessRequirementManifest(seed);

    const error = getValidationError(() => createProcessRequirementSnapshot(seed));
    expect(error.summary).toBe("Process-requirements package is invalid.");
    expect(error.affectedInputReferences).toEqual(["process-requirements-entries"]);
    expect(JSON.stringify(error)).not.toContain("sensitive-missing-entry-marker");
  });
});