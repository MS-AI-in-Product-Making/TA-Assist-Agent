import { describe, expect, it } from "vitest";
import * as contractExports from "./index.js";
import {
  processRequirementApplicabilitySchema,
  processRequirementEntrySchema,
  processRequirementEvaluationRequestSchema,
  processRequirementEvaluationSchema,
  processRequirementListRequestSchema,
  processRequirementLoadRequestSchema,
  processRequirementManifestSchema,
  processRequirementSeedPackageSchema,
  processRequirementSourceMetadataSchema,
  processRequirementProvenanceSchema,
  processRequirementVersionSchema,
} from "./process-requirements-contracts.js";

const hash = "a".repeat(64);

const validSource = () => ({
  sourceAlias: "ta-process-requirements",
  hash,
  revision: "Beta",
  sheet: "TA Process & Requirements",
  range: "B7:T55",
  sourceClassification: "confidential" as const,
  releasedClassification: "internal" as const,
  owner: "Dimensional Management",
  reviewedAt: "2026-09-09T00:00:00.000Z",
});

const validProvenance = () => ({
  sourceAlias: "ta-process-requirements",
  sourceFileHash: hash,
  sourceRevision: "Beta",
  sheetName: "TA Process & Requirements",
  sourceRange: "B7:B9",
  effectiveVersion: "process-requirements-v1" as const,
  owner: "Dimensional Management",
  confidence: "reviewed" as const,
  changeSummary: "Normalized controlled process requirement.",
});

const validEntry = (entryType: "requirement" | "warning" | "escalation" | "milestone" | "instruction" | "definition") => ({
  entryId: `${entryType}-example`,
  entryType,
  topic: "analysis-method" as const,
  title: `${entryType} example`,
  message: "Use the governed analysis method for the available facts.",
  normativeStrength: entryType === "definition" ? "informational" as const : "must" as const,
  applicability: {
    actor: "odm" as const,
    analysisMethod: "one-dimensional-rss" as const,
    characteristicClass: "cts" as const,
    priority: "P0" as const,
    lifecycleStage: "asr" as const,
    subject: "camera-fov-clearance" as const,
    factorRepresentation: "position" as const,
    requirementGapPresent: true,
    workbookArea: "auto-summary" as const,
    minimumToleranceCountExclusive: 10,
    hasThreeDimensionalSensitivity: true,
    requiredFacts: ["actor", "analysisMethod", "toleranceCount"],
  },
  relatedEntryIds: [],
  provenance: validProvenance(),
});

const validManifest = () => ({
  version: "process-requirements-v1" as const,
  classification: "internal" as const,
  releasedAt: "2026-09-09T00:00:00.000Z",
  changeSummary: "Initial reviewed process requirements snapshot.",
  counts: {
    sources: 1,
    entries: 6,
    entryTypes: {
      requirement: 1,
      warning: 1,
      escalation: 1,
      milestone: 1,
      instruction: 1,
      definition: 1,
    },
  },
  sourcesHash: hash,
  entriesHash: hash,
  contentHash: hash,
});

const validMatchedEntry = () => ({
  entryId: "warning-example",
  entryType: "warning" as const,
  topic: "analysis-method" as const,
  title: "warning example",
  message: "Use the governed analysis method for the available facts.",
  normativeStrength: "must" as const,
  relatedFactReferences: ["analysisMethod", "toleranceCount"],
  evidence: validProvenance(),
});

describe("F0 process requirement contracts", () => {
  it("exports the process requirements contracts from the package entry point", () => {
    expect(contractExports.processRequirementEntrySchema).toBe(processRequirementEntrySchema);
  });

  it.each(["process-requirements-v1", "process-requirements-v2", "process-requirements-v3"] as const)(
    "accepts the %s version",
    (version) => {
      expect(processRequirementVersionSchema.parse(version)).toBe(version);
    },
  );

  it("accepts controlled component categories and rejects empty or duplicate facts", () => {
    const evaluationRequest = {
      componentCategories: ["battery-cts", "cover-fit-and-function"],
    } as const;

    expect(processRequirementEvaluationRequestSchema.parse(evaluationRequest)).toEqual(evaluationRequest);
    expect(processRequirementApplicabilitySchema.parse({
      componentCategory: "battery-cts",
      requiredFacts: ["componentCategories"],
    })).toEqual({
      componentCategory: "battery-cts",
      requiredFacts: ["componentCategories"],
    });
    expect(processRequirementEvaluationRequestSchema.safeParse({ componentCategories: [] }).success).toBe(false);
    expect(processRequirementEvaluationRequestSchema.safeParse({
      componentCategories: ["battery-cts", "battery-cts"],
    }).success).toBe(false);
    expect(processRequirementEvaluationRequestSchema.safeParse({
      componentCategories: ["uncontrolled-category"],
    }).success).toBe(false);
  });

  it("accepts approved-transcription source metadata and provenance without workbook coordinates", () => {
    const source = {
      sourceType: "approved-transcription" as const,
      sourceAlias: "approved-priority-guidance",
      hash,
      revision: "user-approved-2026-09-16",
      section: "priority-definitions-p0-p3",
      sourceClassification: "confidential" as const,
      releasedClassification: "internal" as const,
      owner: "Dimensional Management",
      reviewedAt: "2026-09-16T00:00:00.000Z",
    };
    const provenance = {
      sourceType: "approved-transcription" as const,
      sourceAlias: source.sourceAlias,
      sourceContentHash: hash,
      sourceRevision: source.revision,
      section: "priority-p0",
      effectiveVersion: "process-requirements-v3" as const,
      owner: source.owner,
      confidence: "reviewed" as const,
      changeSummary: "Add approved P0 priority guidance.",
    };

    expect(processRequirementSourceMetadataSchema.parse(source)).toEqual(source);
    expect(processRequirementProvenanceSchema.parse(provenance)).toEqual(provenance);
    expect(processRequirementSourceMetadataSchema.safeParse({ ...source, sheet: "invented" }).success).toBe(false);
    expect(processRequirementProvenanceSchema.safeParse({ ...provenance, sourceRange: "A1:A4" }).success).toBe(false);
  });

  it("accepts a non-negative integer maximum tolerance count", () => {
    const applicability = {
      maximumToleranceCountExclusive: 4,
      requiredFacts: ["toleranceCount"],
    } as const;

    expect(processRequirementApplicabilitySchema.parse(applicability)).toEqual(applicability);
  });

  it.each([-1, 3.5])("rejects maximum tolerance count %s", (maximumToleranceCountExclusive) => {
    expect(processRequirementApplicabilitySchema.safeParse({
      maximumToleranceCountExclusive,
      requiredFacts: ["toleranceCount"],
    }).success).toBe(false);
  });

  it.each(["requirement", "warning", "escalation", "milestone", "instruction", "definition"] as const)(
    "accepts a strict %s entry",
    (entryType) => {
      expect(processRequirementEntrySchema.parse(validEntry(entryType)).entryType).toBe(entryType);
      expect(processRequirementEntrySchema.safeParse({ ...validEntry(entryType), unknown: true }).success).toBe(false);
      expect(processRequirementEntrySchema.safeParse({
        ...validEntry(entryType),
        provenance: {
          source: {
            sourceAlias: "ta-process-requirements",
            hash,
            revision: "Beta",
            sheet: "TA Process & Requirements",
            range: "B7:B9",
          },
          effectiveVersion: "process-requirements-v1",
          owner: "Dimensional Management",
          confidence: "reviewed",
          changeSummary: "Normalized controlled process requirement.",
        },
      }).success).toBe(false);
    },
  );

  it("rejects source paths and unknown source metadata", () => {
    expect(processRequirementSourceMetadataSchema.parse(validSource())).toEqual(validSource());
    expect(processRequirementSourceMetadataSchema.safeParse({ ...validSource(), sourcePath: "C:\\controlled\\source.xlsx" }).success).toBe(false);
    expect(processRequirementSourceMetadataSchema.safeParse({ ...validSource(), unknown: true }).success).toBe(false);
  });

  it("accepts strict manifest and seed package contracts", () => {
    const entries = (["requirement", "warning", "escalation", "milestone", "instruction", "definition"] as const).map(validEntry);
    const seed = { manifest: validManifest(), sources: [validSource()], entries };

    expect(processRequirementManifestSchema.parse(validManifest())).toEqual(validManifest());
    expect(processRequirementSeedPackageSchema.parse(seed)).toEqual(seed);
    expect(processRequirementManifestSchema.safeParse({ ...validManifest(), unknown: true }).success).toBe(false);
    expect(processRequirementSeedPackageSchema.safeParse({ ...seed, unknown: true }).success).toBe(false);
  });

  it("accepts only strict structured load, list, and evaluation requests", () => {
    const loadRequest = { version: "process-requirements-v1" as const };
    const listRequest = {
      topics: ["inputs", "outputs"] as const,
      entryTypes: ["requirement", "instruction"] as const,
    };
    const evaluationRequest = {
      actor: "odm" as const,
      analysisMethod: "one-dimensional-rss" as const,
      characteristicClass: "cts" as const,
      priority: "P0" as const,
      lifecycleStage: "asr" as const,
      subject: "camera-fov-clearance" as const,
      factorRepresentation: "position" as const,
      requirementGapPresent: true,
      workbookArea: "auto-summary" as const,
      toleranceCount: 11,
      hasThreeDimensionalSensitivity: true,
    };

    expect(processRequirementLoadRequestSchema.parse(loadRequest)).toEqual(loadRequest);
    expect(processRequirementListRequestSchema.parse(listRequest)).toEqual(listRequest);
    expect(processRequirementEvaluationRequestSchema.parse(evaluationRequest)).toEqual(evaluationRequest);
    expect(processRequirementLoadRequestSchema.safeParse({ ...loadRequest, unknown: true }).success).toBe(false);
    expect(processRequirementListRequestSchema.safeParse({ ...listRequest, unknown: true }).success).toBe(false);
    expect(processRequirementListRequestSchema.safeParse({ ...listRequest, version: "process-requirements-v1" }).success).toBe(false);
    expect(processRequirementEvaluationRequestSchema.safeParse({ ...evaluationRequest, rawProse: "forbidden" }).success).toBe(false);
    expect(processRequirementEvaluationRequestSchema.safeParse({
      ...evaluationRequest,
      version: "process-requirements-v1",
    }).success).toBe(false);
    expect(processRequirementEvaluationRequestSchema.safeParse({ facts: evaluationRequest }).success).toBe(false);
    expect(processRequirementEvaluationRequestSchema.safeParse({
      version: "process-requirements-v1",
      facts: evaluationRequest,
    }).success).toBe(false);
  });

  it.each([
    {
      status: "matched" as const,
      resolvedTargets: { sigma: 6 as const },
      factsUsed: ["characteristicClass"],
      matchedEntries: [validMatchedEntry()],
      missingFacts: ["subject"],
    },
    {
      status: "insufficient-facts" as const,
      resolvedTargets: {},
      factsUsed: [],
      matchedEntries: [],
      missingFacts: ["analysisMethod"],
    },
    {
      status: "not-applicable" as const,
      resolvedTargets: {},
      factsUsed: ["actor"],
      matchedEntries: [],
      missingFacts: [],
    },
  ])("accepts a strict $status evaluation result", (result) => {
    const evaluation = { version: "process-requirements-v1" as const, ...result };

    expect(processRequirementEvaluationSchema.parse(evaluation)).toEqual(evaluation);
    expect(processRequirementEvaluationSchema.safeParse({ ...evaluation, unknown: true }).success).toBe(false);
  });

  it("rejects pass/fail and raw prose from matched entries", () => {
    const base = {
      version: "process-requirements-v1" as const,
      status: "matched" as const,
      resolvedTargets: { sigma: 4 as const },
      factsUsed: ["characteristicClass"],
      matchedEntries: [validMatchedEntry()],
      missingFacts: [],
    };

    expect(processRequirementEvaluationSchema.safeParse({ ...base, pass: true }).success).toBe(false);
    expect(processRequirementEvaluationSchema.safeParse({
      ...base,
      matchedEntries: [{ ...validMatchedEntry(), rawProse: "forbidden" }],
    }).success).toBe(false);
  });

  it("accepts a strict advisory priority recommendation", () => {
    const evaluation = {
      version: "process-requirements-v3" as const,
      status: "matched" as const,
      resolvedTargets: {},
      factsUsed: ["componentCategories"],
      matchedEntries: [validMatchedEntry()],
      missingFacts: [],
      priorityRecommendation: {
        selectedPriority: "P0" as const,
        matchedEntryIds: ["warning-example"],
        requiresMeDmAlignment: true as const,
      },
    };

    expect(processRequirementEvaluationSchema.parse(evaluation)).toEqual(evaluation);
    expect(processRequirementEvaluationSchema.safeParse({
      ...evaluation,
      priorityRecommendation: { ...evaluation.priorityRecommendation, requiresMeDmAlignment: false },
    }).success).toBe(false);
    expect(processRequirementEvaluationSchema.safeParse({
      ...evaluation,
      priorityRecommendation: { ...evaluation.priorityRecommendation, matchedEntryIds: [] },
    }).success).toBe(false);
    expect(processRequirementEvaluationSchema.safeParse({
      ...evaluation,
      priorityRecommendation: {
        ...evaluation.priorityRecommendation,
        matchedEntryIds: ["not-a-matched-entry"],
      },
    }).success).toBe(false);
    expect(processRequirementEvaluationSchema.safeParse({
      ...evaluation,
      status: "not-applicable",
      matchedEntries: [],
    }).success).toBe(false);
  });
});