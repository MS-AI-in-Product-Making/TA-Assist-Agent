import { describe, expect, it } from "vitest";
import type {
  F7FactorEvidence,
  F7MeasurementImportAuthority,
  F7MeasurementImportStoredBatch,
} from "@ai-assist/contracts";
import { createF7MeasurementImportAuthority } from "@ai-assist/workbook-catalog";
import {
  F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS,
  MAX_F7_MEASUREMENT_IMPORT_PREVIEWS,
  MAX_F7_MEASUREMENT_IMPORT_TEMPLATES,
  createF7MeasurementImportRegistry,
} from "./f7-measurement-import-registry.js";

const WORKBOOK_HASH = "a".repeat(64);
const SESSION_ID = "session-1";
const OTHER_SESSION_ID = "session-2";
const BASE_TIME = Date.UTC(2026, 8, 16, 8, 0, 0, 0);

function makeFactor(index: number): F7FactorEvidence {
  const row = 20 + index;
  const candidateId = `${(index + 1).toString(16).padStart(64, "0")}`;
  const factorId = `${(index + 101).toString(16).padStart(64, "0")}`;
  return {
    workbookContentHash: WORKBOOK_HASH,
    worksheetName: "Analysis-A",
    tableId: `table-${index + 1}`,
    sourceRow: row,
    sourceCells: {
      factorName: `Analysis-A!B${row}`,
      distribution: `Analysis-A!Q${row}`,
      excelSignedMean: `Analysis-A!R${row}`,
      standardDeviation: `Analysis-A!T${row}`,
      factorLowerSpecLimit: `Analysis-A!H${row}`,
      factorUpperSpecLimit: `Analysis-A!I${row}`,
      lowerSpecLimit: `Analysis-A!H${row}`,
      upperSpecLimit: `Analysis-A!I${row}`,
    },
    factorCandidateId: candidateId,
    factorId,
    factorName: `Factor ${index + 1}`,
    partNumber: `PN-${index + 1}`,
    dimId: `DIM-${index + 1}`,
    unit: "mm",
    unitSource: "user_confirmed",
    designNominal: 12.5 + index,
    upperTolerance: 0.2,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    calculatedMean: 12.55 + index,
    tolerance: 0.1,
    oneSigma: 0.02,
    percentContributionToSigma: 1,
    loopCoefficient: 1,
    physicalMean: 12.55 + index,
    signedContributionMean: 12.55 + index,
    baselineSampler: {
      samplerId: "NORMAL_LOCATION_SCALE_V1",
      physicalMean: 12.55 + index,
      standardDeviation: 0.02,
      support: "REAL",
    },
    specificationSource: "Worksheet",
    lowerSpecLimit: 12.4 + index,
    upperSpecLimit: 12.7 + index,
  };
}

function makeAuthority(input: {
  sessionId?: string;
  templateId: string;
  measurementImportRevision?: number;
  worksheetStableId?: string;
  factors?: readonly F7FactorEvidence[];
}): F7MeasurementImportAuthority {
  return createF7MeasurementImportAuthority({
    sessionId: input.sessionId ?? SESSION_ID,
    templateId: input.templateId,
    workbookContentHash: WORKBOOK_HASH,
    worksheetName: "Analysis-A",
    worksheetStableId: input.worksheetStableId ?? "worksheet-stable-001",
    measurementImportRevision: input.measurementImportRevision ?? 0,
    factors: input.factors ?? [makeFactor(0), makeFactor(1)],
  });
}

function makeStoredBatch(input: {
  sessionId?: string;
  previewId: string;
  expiresAt: string;
  authority: F7MeasurementImportAuthority;
  sessionStateDigest?: string;
  factorSetDigest?: string;
  factorIds?: readonly string[];
}): F7MeasurementImportStoredBatch {
  const factorIds = input.factorIds ?? input.authority.manifest.factors.slice(0, 1).map((factor) => factor.factorId);
  const factors = factorIds.map((factorId, index) => {
    const manifestFactor = input.authority.manifest.factors.find((factor) => factor.factorId === factorId);
    if (!manifestFactor) throw new Error(`missing manifest factor ${factorId}`);
    const observations = [
      { disposition: "included" as const, value: manifestFactor.designNominal, originalRow: 20 + index * 3 },
      { disposition: "included" as const, value: manifestFactor.designNominal + 0.02, originalRow: 21 + index * 3 },
      { disposition: "included" as const, value: manifestFactor.designNominal - 0.01, originalRow: 22 + index * 3 },
    ];
    return {
      factorId,
      factorName: manifestFactor.factorName,
      unit: manifestFactor.unit,
      replacesExistingFactor: true,
      dataset: {
        factorId,
        unit: manifestFactor.unit,
        structure: "ORDERED_INDIVIDUALS" as const,
        sourceReference: "bulk-import-template",
        importedAt: new Date(BASE_TIME).toISOString(),
        msaStatus: "available" as const,
        observations,
        missingRowCount: 0,
        rejectionSummaries: [],
        originalRowCount: observations.length,
        analyzedCount: observations.length,
        contentHash: `${(index + 501).toString(16).padStart(64, "0")}`,
      },
      validation: {
        status: "ready" as const,
        blockingIssues: [],
        advisoryIssues: [],
        candidateEligibility: {
          normal: "eligible" as const,
          lognormal: "eligible" as const,
          weibull: "eligible" as const,
          gamma: "eligible" as const,
          uniform: "eligible_with_boundary_warning" as const,
        },
      },
    };
  });

  return {
    previewId: input.previewId,
    sessionId: input.sessionId ?? input.authority.sessionId,
    expiresAt: input.expiresAt,
    sessionStateDigest: input.sessionStateDigest ?? input.authority.sessionStateDigest,
    factorSetDigest: input.factorSetDigest ?? input.authority.manifest.factorSetDigest,
    authority: input.authority,
    replacementFactorIds: factorIds.slice(),
    factors,
  };
}

function createClock(initial = BASE_TIME) {
  let value = initial;
  return {
    now: () => value,
    set: (next: number) => {
      value = next;
    },
    advance: (deltaMs: number) => {
      value += deltaMs;
    },
  };
}

function createIdSource(ids: readonly string[]) {
  const queue = [...ids];
  return () => {
    const next = queue.shift();
    if (!next) throw new Error("test id queue exhausted");
    return next;
  };
}

describe("createF7MeasurementImportRegistry", () => {
  it("validates injected dependencies and rejects invalid or duplicate opaque ids", () => {
    expect(() => createF7MeasurementImportRegistry({ now: null as never, createId: () => "a".repeat(32) })).toThrow();
    expect(() => createF7MeasurementImportRegistry({ now: () => BASE_TIME, createId: null as never })).toThrow();

    const invalidIdRegistry = createF7MeasurementImportRegistry({
      now: () => BASE_TIME,
      createId: createIdSource(["not-csprng", "a".repeat(32)]),
    });
    expect(() => invalidIdRegistry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId }),
    })).toThrow(/id/i);

    const duplicateId = "b".repeat(32);
    const duplicateRegistry = createF7MeasurementImportRegistry({
      now: () => BASE_TIME,
      createId: createIdSource([duplicateId, duplicateId]),
    });
    const template = duplicateRegistry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId }),
    });
    expect(template.templateId).toBe(duplicateId);
    expect(() => duplicateRegistry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: template.authority,
      }),
    })).toThrow(/duplicate/i);
  });

  it("stores a frozen deep-cloned authoritative template, resolves it for the owning session, and increments session generations", () => {
    const clock = createClock();
    const registry = createF7MeasurementImportRegistry({
      now: clock.now,
      createId: createIdSource(["1".repeat(32), "2".repeat(32)]),
    });
    const sourceAuthority = structuredClone(makeAuthority({ templateId: "1".repeat(32) }));
    const first = registry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: () => sourceAuthority,
    });

    sourceAuthority.manifest.factors[0]!.factorName = "Mutated after register";

    const resolved = registry.resolveTemplate({
      sessionId: SESSION_ID,
      templateId: first.templateId,
    });
    expect(resolved.status).toBe("available");
    if (resolved.status !== "available") throw new Error("expected available template");
    expect(resolved.sessionGeneration).toBe(1);
    expect(resolved.authority.manifest.templateId).toBe(first.templateId);
    expect(resolved.authority.manifest.factors[0]?.factorName).toBe("Factor 1");
    expect(Object.isFrozen(resolved.authority)).toBe(true);
    expect(Object.isFrozen(resolved.authority.manifest)).toBe(true);
    expect(Object.isFrozen(resolved.authority.manifest.factors)).toBe(true);
    expect(Object.isFrozen(resolved.authority.manifest.factors[0] ?? {})).toBe(true);

    const second = registry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({
        templateId,
        measurementImportRevision: 1,
        worksheetStableId: "worksheet-stable-002",
      }),
    });
    expect(second.sessionGeneration).toBe(2);
    expect(registry.resolveTemplate({ sessionId: SESSION_ID, templateId: first.templateId })).toEqual({ status: "stale" });
    expect(registry.resolveTemplate({ sessionId: SESSION_ID, templateId: second.templateId })).toMatchObject({
      status: "available",
      sessionGeneration: 2,
    });
  });

  it("invalidates prior previews on newer preview or template generations and allows exactly one synchronous claim", () => {
    const clock = createClock();
    const registry = createF7MeasurementImportRegistry({
      now: clock.now,
      createId: createIdSource([
        "1".repeat(32),
        "2".repeat(32),
        "3".repeat(32),
        "4".repeat(32),
        "5".repeat(32),
      ]),
    });

    const template = registry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId }),
    });
    const firstPreview = registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: template.authority,
      }),
    });
    const secondPreview = registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: template.authority,
      }),
    });

    expect(firstPreview.previewGeneration).toBe(1);
    expect(secondPreview.previewGeneration).toBe(2);
    expect(registry.claimPreview({ sessionId: SESSION_ID, previewId: firstPreview.previewId })).toEqual({ status: "stale" });

    const firstClaim = registry.claimPreview({ sessionId: SESSION_ID, previewId: secondPreview.previewId });
    expect(firstClaim.status).toBe("claimed");
    if (firstClaim.status !== "claimed") throw new Error("expected claimed preview");
    expect(firstClaim.preview.previewId).toBe(secondPreview.previewId);
    expect(Object.isFrozen(firstClaim.preview)).toBe(true);
    expect(registry.claimPreview({ sessionId: SESSION_ID, previewId: secondPreview.previewId })).toEqual({ status: "consumed" });

    const nextTemplate = registry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId, measurementImportRevision: 1 }),
    });
    const nextPreview = registry.storePreview({
      sessionId: SESSION_ID,
      templateId: nextTemplate.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: nextTemplate.authority,
      }),
    });
    expect(nextPreview.sessionGeneration).toBe(2);
    expect(nextPreview.previewGeneration).toBe(1);
    expect(registry.claimPreview({ sessionId: SESSION_ID, previewId: firstPreview.previewId })).toEqual({ status: "stale" });
  });

  it("distinguishes session ownership, exact ttl boundaries, and process restart invalidation without leaking data", () => {
    const clock = createClock();
    const registry = createF7MeasurementImportRegistry({
      now: clock.now,
      createId: createIdSource(["1".repeat(32), "2".repeat(32)]),
    });
    const template = registry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId }),
    });
    const preview = registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: template.authority,
      }),
    });

    expect(registry.resolveTemplate({ sessionId: OTHER_SESSION_ID, templateId: template.templateId })).toEqual({ status: "session_mismatch" });
    expect(registry.claimPreview({ sessionId: OTHER_SESSION_ID, previewId: preview.previewId })).toEqual({ status: "session_mismatch" });

    clock.advance(F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS - 1);
    expect(registry.resolveTemplate({ sessionId: SESSION_ID, templateId: template.templateId })).toMatchObject({ status: "available" });
    expect(registry.claimPreview({ sessionId: SESSION_ID, previewId: preview.previewId }).status).toBe("claimed");

    const expiringClock = createClock();
    const expiringRegistry = createF7MeasurementImportRegistry({
      now: expiringClock.now,
      createId: createIdSource(["3".repeat(32), "4".repeat(32)]),
    });
    const expiringTemplate = expiringRegistry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId }),
    });
    const expiringPreview = expiringRegistry.storePreview({
      sessionId: SESSION_ID,
      templateId: expiringTemplate.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: expiringTemplate.authority,
      }),
    });

    expiringClock.advance(F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS);
    expect(expiringRegistry.resolveTemplate({ sessionId: SESSION_ID, templateId: expiringTemplate.templateId })).toEqual({ status: "expired" });
    expect(expiringRegistry.claimPreview({ sessionId: SESSION_ID, previewId: expiringPreview.previewId })).toEqual({ status: "expired" });

    const restarted = createF7MeasurementImportRegistry({
      now: clock.now,
      createId: createIdSource(["5".repeat(32)]),
    });
    expect(restarted.resolveTemplate({ sessionId: SESSION_ID, templateId: template.templateId })).toEqual({ status: "not_found" });
    expect(restarted.claimPreview({ sessionId: SESSION_ID, previewId: preview.previewId })).toEqual({ status: "not_found" });
  });

  it("evicts the oldest templates and previews deterministically after pruning expired records", () => {
    const clock = createClock();
    const ids = Array.from({ length: MAX_F7_MEASUREMENT_IMPORT_TEMPLATES + MAX_F7_MEASUREMENT_IMPORT_PREVIEWS + 4 }, (_, index) =>
      `${(index + 1).toString(16).padStart(32, "0")}`,
    );
    const registry = createF7MeasurementImportRegistry({ now: clock.now, createId: createIdSource(ids) });

    const templates = Array.from({ length: MAX_F7_MEASUREMENT_IMPORT_TEMPLATES }, (_, index) => registry.registerTemplate({
      sessionId: `template-session-${index + 1}`,
      createAuthority: ({ templateId }) => makeAuthority({
        sessionId: `template-session-${index + 1}`,
        templateId,
        worksheetStableId: `worksheet-${index + 1}`,
        factors: [makeFactor(index + 10)],
      }),
    }));

    const evictingTemplate = registry.registerTemplate({
      sessionId: "template-session-overflow",
      createAuthority: ({ templateId }) => makeAuthority({
        sessionId: "template-session-overflow",
        templateId,
        worksheetStableId: "worksheet-overflow",
        factors: [makeFactor(99)],
      }),
    });
    expect(evictingTemplate.sessionGeneration).toBe(1);
    expect(registry.resolveTemplate({
      sessionId: templates[0]!.authority.sessionId,
      templateId: templates[0]!.templateId,
    })).toEqual({ status: "not_found" });
    expect(registry.resolveTemplate({
      sessionId: templates[MAX_F7_MEASUREMENT_IMPORT_TEMPLATES - 1]!.authority.sessionId,
      templateId: templates[MAX_F7_MEASUREMENT_IMPORT_TEMPLATES - 1]!.templateId,
    })).toMatchObject({ status: "available" });

    clock.advance(F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS);
    const pruningTemplate = registry.registerTemplate({
      sessionId: "template-session-pruned",
      createAuthority: ({ templateId }) => makeAuthority({
        sessionId: "template-session-pruned",
        templateId,
        worksheetStableId: "worksheet-pruned",
        factors: [makeFactor(120)],
      }),
    });
    expect(registry.resolveTemplate({ sessionId: "template-session-pruned", templateId: pruningTemplate.templateId })).toMatchObject({ status: "available" });

    const previewClock = createClock();
    const previewIds = Array.from({ length: MAX_F7_MEASUREMENT_IMPORT_PREVIEWS * 2 + 2 }, (_, index) =>
      `${(index + 501).toString(16).padStart(32, "0")}`,
    );
    const previewRegistry = createF7MeasurementImportRegistry({
      now: previewClock.now,
      createId: createIdSource(previewIds),
    });

    const previewTemplates = Array.from({ length: MAX_F7_MEASUREMENT_IMPORT_PREVIEWS }, (_, index) => previewRegistry.registerTemplate({
      sessionId: `preview-session-${index + 1}`,
      createAuthority: ({ templateId }) => makeAuthority({
        sessionId: `preview-session-${index + 1}`,
        templateId,
        worksheetStableId: `preview-worksheet-${index + 1}`,
        factors: [makeFactor(index + 200)],
      }),
    }));

    const previews = previewTemplates.map((template) => previewRegistry.storePreview({
      sessionId: template.authority.sessionId,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: template.authority,
      }),
    }));

    const overflowTemplate = previewRegistry.registerTemplate({
      sessionId: "preview-session-overflow",
      createAuthority: ({ templateId }) => makeAuthority({
        sessionId: "preview-session-overflow",
        templateId,
        worksheetStableId: "preview-overflow-template",
        factors: [makeFactor(400)],
      }),
    });
    const overflowPreview = previewRegistry.storePreview({
      sessionId: overflowTemplate.authority.sessionId,
      templateId: overflowTemplate.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: overflowTemplate.authority,
      }),
    });

    expect(previewRegistry.claimPreview({
      sessionId: previews[0]!.storedBatch.sessionId,
      previewId: previews[0]!.previewId,
    })).toEqual({ status: "not_found" });
    expect(previewRegistry.claimPreview({
      sessionId: overflowPreview.storedBatch.sessionId,
      previewId: overflowPreview.previewId,
    }).status).toBe("claimed");
  });

  it("rejects preview batches whose session, authority, or template binding does not match the current template generation", () => {
    const registry = createF7MeasurementImportRegistry({
      now: () => BASE_TIME,
      createId: createIdSource(["1".repeat(32), "2".repeat(32), "3".repeat(32), "4".repeat(32), "5".repeat(32)]),
    });
    const template = registry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId }),
    });

    expect(() => registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        sessionId: OTHER_SESSION_ID,
        previewId,
        expiresAt,
        authority: template.authority,
      }),
    })).toThrow(/session/i);

    expect(() => registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: makeAuthority({
          sessionId: SESSION_ID,
          templateId: "f".repeat(32),
        }),
      }),
    })).toThrow(/template/i);

    registry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId, measurementImportRevision: 1 }),
    });
    expect(() => registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: template.authority,
      }),
    })).toThrow(/stale/i);
  });

  it("rejects forged preview authority payloads even when ids and authority digest are replayed", () => {
    const registry = createF7MeasurementImportRegistry({
      now: () => BASE_TIME,
      createId: createIdSource(["1".repeat(32), "2".repeat(32), "3".repeat(32), "4".repeat(32)]),
    });
    const template = registry.registerTemplate({
      sessionId: SESSION_ID,
      createAuthority: ({ templateId }) => makeAuthority({ templateId }),
    });

    const forgedAuthority = structuredClone(template.authority);
    forgedAuthority.manifest.factors[0]!.factorName = "Forged Factor Name";

    expect(() => registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: forgedAuthority,
      }),
    })).toThrow(/authorit/i);
    expect(registry.claimPreview({ sessionId: SESSION_ID, previewId: "2".repeat(32) })).toEqual({ status: "not_found" });

    expect(() => registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: template.authority,
        sessionStateDigest: "f".repeat(64),
      }),
    })).toThrow(/session.*digest/i);
    expect(registry.claimPreview({ sessionId: SESSION_ID, previewId: "3".repeat(32) })).toEqual({ status: "not_found" });

    expect(() => registry.storePreview({
      sessionId: SESSION_ID,
      templateId: template.templateId,
      createStoredBatch: ({ previewId, expiresAt }) => makeStoredBatch({
        previewId,
        expiresAt,
        authority: template.authority,
        factorSetDigest: "e".repeat(64),
      }),
    })).toThrow(/factor.*digest/i);
    expect(registry.claimPreview({ sessionId: SESSION_ID, previewId: "4".repeat(32) })).toEqual({ status: "not_found" });
  });
});