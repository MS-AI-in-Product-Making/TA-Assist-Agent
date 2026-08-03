import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  capabilityEntrySchema,
  capabilityValidationRequestSchema,
  capabilityValidationResultSchema,
  capabilityTierSchema,
  calculationRequestSchema,
  calculationResultSchema,
  cpkRequestSchema,
  cpkResultSchema,
  comparisonRequestSchema,
  comparisonResultSchema,
  createTypedError,
  drawingGovernanceRequestSchema,
  drawingGovernanceResultSchema,
  exceptionResolutionRequestSchema,
  exceptionResolutionResultSchema,
  f2InitialWorkflowRequestSchema,
  f2InitialWorkflowResultSchema,
  identifierQualityCheckRequestSchema,
  identifierQualityCheckResultSchema,
  interpretationRequestSchema,
  interpretationResultSchema,
  unifiedExceptionResolutionV2RequestSchema,
  unifiedExceptionResolutionV2ResultSchema,
  engineeringRuleEntrySchema,
  engineeringRuleQuerySchema,
  internalToleranceGuidanceEntrySchema,
  internalToleranceGuidanceManifestSchema,
  internalToleranceGuidanceRequestSchema,
  internalToleranceGuidanceResultSchema,
  internalToleranceGuidanceSourceMetadataSchema,
  interpretationEntryTypeSchema,
  interpretationKnowledgeEntrySchema,
  interpretationKnowledgeManifestSchema,
  interpretationKnowledgeSeedPackageSchema,
  interpretationKnowledgeSourceMetadataSchema,
  interpretationProvenanceSchema,
  interpretationRuleEvaluationRequestSchema,
  interpretationRuleEvaluationSchema,
  interpretationRuleLoadRequestSchema,
  interpretationRuleVersionSchema,
  knowledgeBaseQueryResultSchema,
  knowledgeBaseManifestSchema,
  knowledgeBaseQueryRequestSchema,
  workbookCatalogRequestSchema,
  workbookCatalogResultSchema,
  dataClassificationSchema,
  errorCodeSchema,
  runRequestSchema,
  requiredFieldCheckRequestSchema,
  requiredFieldCheckResultSchema,
  semanticTableDetectionRequestSchema,
  semanticTableDetectionResultSchema,
  skillResultSchema,
  terminologyEntrySchema,
  typedErrorSchema,
  worksheetAnalysisAssetsRequestSchema,
  worksheetAnalysisAssetsResultSchema,
  worksheetImageReadRequestSchema,
  worksheetImageReadResultSchema,
  worksheetSelectionViewRequestSchema,
  worksheetSelectionViewResultSchema,
  workflowRequestSchema,
  workflowResultSchema,
} from "./index.js";

describe("F2 Initial workflow contracts", () => {
  const workbookContentHash = "f".repeat(64);
  const worksheetAnalysisAssets = {
    contractVersion: "v1",
    workbook: { classification: "confidential", contentHash: workbookContentHash, catalogContractVersion: "v1" },
    worksheets: [{
      worksheetName: "Analysis",
      toleranceLoopDescription: "public demo loop",
      factorTables: [],
      formulaCells: [],
      imageAssets: [],
    }],
  };
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    toleranceUnitAssumption: "mm",
    worksheetAnalysisAssets,
  };
  const readyWorksheet = {
    worksheetName: "Analysis",
    status: "readyForNextFeature",
    blockingIssues: [],
    mappingRecords: [],
    capabilityChecks: [],
    governanceSignals: [],
  };
  const result = {
    contractVersion: "v1",
    inputClassification: "confidential",
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    workbookContentHash,
    toleranceUnitAssumption: "mm",
    status: "completed",
    worksheets: [readyWorksheet],
    summary: {
      worksheetsChecked: 1,
      readyForNextFeatureCount: 1,
      blockedWorksheetCount: 0,
      blockingIssueCount: 0,
      mappingRecordCount: 0,
      capabilityCheckCount: 0,
      governanceSignalCount: 0,
    },
  };
  const rowSource = { worksheetName: "Blocked", tableId: "factor-table-1", sourceRow: 2 };
  const capabilityEvidence = {
    ...rowSource,
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    itemId: "item-demo-bracket-arm",
    capabilityEntryId: "cap-demo-bracket",
    totalTolerance: 0.4,
    unit: "mm",
    actualDistribution: "uniform",
    recommendedDistribution: "normal",
    hitKeywords: ["bracket arm"],
    sourceCells: { upperTolerance: "Blocked!D2", lowerTolerance: "Blocked!E2", distribution: "Blocked!F2" },
  };
  const mappingSource = {
    ...rowSource,
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    partCategory: "demo-bracket",
    factorName: "bracket arm length",
    partName: "mount",
    sourceCells: { partCategory: "Blocked!C2", factorName: "Blocked!A2", partName: "Blocked!B2" },
  };
  const candidate = {
    itemId: "item-demo-bracket-arm",
    itemName: "demo bracket arm",
    capabilityEntryId: "cap-demo-bracket",
    hitKeywords: ["bracket arm"],
    hitSources: ["factorName"],
  };
  const blockedWorksheet = {
    worksheetName: "Blocked",
    status: "blocked",
    blockingIssues: [
      { ...rowSource, issueCode: "required_field_unavailable", field: "partName", reasonCode: "missing" },
      { worksheetName: "Blocked", tableId: "empty-table", issueCode: "factor_table_has_no_rows" },
      { worksheetName: "Blocked", issueCode: "cross_section_image_unavailable", reasonCode: "image_missing" },
      { ...capabilityEvidence, issueCode: "tolerance_out_of_range" },
      { ...capabilityEvidence, issueCode: "distribution_mismatch" },
    ],
    mappingRecords: [
      { ...mappingSource, status: "category_not_defined" },
      { ...mappingSource, status: "item_unmatched", canonicalPartCategory: "demo-bracket" },
      { ...mappingSource, status: "item_ambiguous", canonicalPartCategory: "demo-bracket", candidates: [candidate, { ...candidate, itemId: "item-demo-bracket-mount" }] },
    ],
    capabilityChecks: [
      { ...capabilityEvidence, status: "tolerance_and_distribution_match" },
      { ...capabilityEvidence, status: "tolerance_out_of_range" },
      { ...capabilityEvidence, status: "distribution_mismatch" },
      { ...capabilityEvidence, status: "tolerance_and_distribution_mismatch" },
    ],
    governanceSignals: [
      { ...rowSource, field: "drawingNumber", signalKind: "identifier_missing" },
      { ...rowSource, field: "drawingNumber", signalKind: "identifier_evidence_unavailable", reasonCode: "missing_cached_value" },
      { ...rowSource, field: "drawingNumber", signalKind: "identifier_text_invalid" },
      { ...rowSource, field: "dimCharacteristicId", signalKind: "dim_id_duplicate", normalizedDimId: "dim-1" },
    ],
  };
  const blockedResult = {
    ...result,
    status: "blocked",
    worksheets: [blockedWorksheet],
    summary: {
      worksheetsChecked: 1,
      readyForNextFeatureCount: 0,
      blockedWorksheetCount: 1,
      blockingIssueCount: 5,
      mappingRecordCount: 3,
      capabilityCheckCount: 4,
      governanceSignalCount: 4,
    },
  };

  it("accepts strict trusted F1 requests and derived completed results", () => {
    expect(f2InitialWorkflowRequestSchema.parse(request)).toEqual(request);
    expect(f2InitialWorkflowResultSchema.parse(result)).toEqual(result);
    expect(f2InitialWorkflowRequestSchema.safeParse({ ...request, workbookPath: "not-allowed" }).success).toBe(false);
  });

  it("rejects duplicate worksheets and mismatched statuses or summaries", () => {
    expect(f2InitialWorkflowRequestSchema.safeParse({
      ...request,
      worksheetAnalysisAssets: { ...worksheetAnalysisAssets, worksheets: [worksheetAnalysisAssets.worksheets[0], worksheetAnalysisAssets.worksheets[0]] },
    }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...result, worksheets: [readyWorksheet, readyWorksheet] }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...result, status: "blocked" }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...result, summary: { ...result.summary, blockingIssueCount: 1 } }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...result, worksheets: [{ ...readyWorksheet, status: "blocked" }] }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...blockedResult, worksheets: [{ ...blockedWorksheet, status: "readyForNextFeature" }] }).success).toBe(false);
  });

  it("accepts every controlled record branch and all overall statuses", () => {
    expect(f2InitialWorkflowResultSchema.safeParse(blockedResult).success).toBe(true);
    expect(f2InitialWorkflowResultSchema.safeParse({
      ...blockedResult,
      status: "partiallyBlocked",
      worksheets: [blockedWorksheet, readyWorksheet],
      summary: { ...blockedResult.summary, worksheetsChecked: 2, readyForNextFeatureCount: 1 },
    }).success).toBe(true);
  });

  it("rejects unknown nested record keys and incomplete row provenance", () => {
    expect(f2InitialWorkflowResultSchema.safeParse({
      ...blockedResult,
      worksheets: [{ ...blockedWorksheet, mappingRecords: [{ ...blockedWorksheet.mappingRecords[0], unexpected: true }] }],
    }).success).toBe(false);
    const incompleteMapping = structuredClone(blockedWorksheet.mappingRecords[0]);
    Reflect.deleteProperty(incompleteMapping, "sourceRow");
    expect(f2InitialWorkflowResultSchema.safeParse({
      ...blockedResult,
      worksheets: [{ ...blockedWorksheet, mappingRecords: [incompleteMapping] }],
      summary: { ...blockedResult.summary, mappingRecordCount: 1 },
    }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({
      ...blockedResult,
      knowledgeBaseVersion: "v2",
    }).success).toBe(false);
  });
});

describe("Phase 0 contracts", () => {
  it("accepts a classified run request", () => {
    expect(
      runRequestSchema.parse({
        contractVersion: "v1",
        projectId: "demo-project",
        userId: "demo-user",
        sessionId: "demo-session",
        inputClassification: "public",
        retainConfidentialArtifacts: false,
      }).projectId,
    ).toBe("demo-project");
  });

  it("rejects an error without run_id", () => {
    expect(() => typedErrorSchema.parse({ code: "policy_denied" })).toThrow();
  });

  it("deeply freezes typed errors and caller-provided nested details", () => {
    const nested = { entries: [{ value: "safe" }] };
    const error = createTypedError({
      code: "validation_error",
      summary: "Safe error.",
      suggestedAction: "Use valid input.",
      affectedInputReferences: ["safe-reference"],
      details: { nested },
    }) as Error & { readonly nested: { readonly entries: readonly { readonly value: string }[] } };

    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.affectedInputReferences)).toBe(true);
    expect(Object.isFrozen(error.nested)).toBe(true);
    expect(Object.isFrozen(error.nested.entries)).toBe(true);
    expect(Object.isFrozen(error.nested.entries[0]!)).toBe(true);
    expect(() => { (error.affectedInputReferences as string[]).push("changed"); }).toThrow();
    expect(() => { (error.nested.entries[0] as { value: string }).value = "changed"; }).toThrow();
  });

  it("allows only the supported data classifications", () => {
    expect(dataClassificationSchema.parse("confidential")).toBe("confidential");
    expect(() => dataClassificationSchema.parse("restricted")).toThrow();
  });

  it("allows only the supported error codes", () => {
    expect(errorCodeSchema.parse("transient_error")).toBe("transient_error");
    expect(() => errorCodeSchema.parse("unknown_error")).toThrow();
  });

  it("accepts a skill result with evidence and structured output", () => {
    expect(
      skillResultSchema.parse({
        contractVersion: "v1",
        skillId: "smoke",
        outputClassification: "internal",
        evidenceReferences: ["fixture://public/smoke"],
        output: { passed: true },
      }).output,
    ).toEqual({ passed: true });
  });

  it("exposes runRequestSchema through the Node ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        "import { runRequestSchema } from '@ai-assist/contracts'; console.log(runRequestSchema ? 'loaded' : 'missing');",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("loaded");
  });
});

describe("internal tolerance guidance contracts", () => {
  it("accepts a unilateral request with exactly representable values", () => {
    expect(
      internalToleranceGuidanceRequestSchema.safeParse({
        processFamily: "cnc-machining",
        featureType: "diameter",
        nominalValue: 10,
        nominalUnit: "mm",
        tolerance: {
          representation: "unilateral",
          upperValue: 0.25,
          lowerValue: 0.125,
          value: 0.125,
          unit: "mm",
        },
      }).success,
    ).toBe(true);
  });
});

describe("F4 calculation placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-template-regression", "approved-windows-excel-worker"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(calculationRequestSchema.parse(request)).toEqual(request);
    expect(calculationResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(calculationRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(calculationRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(calculationResultSchema.safeParse({
      ...result,
      requiredPrerequisites: ["approved-windows-excel-worker", "approved-template-regression"],
    }).success).toBe(false);
  });
});

describe("F3 drawing governance placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F3",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-ado-access", "canonical-dim-id-policy"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(drawingGovernanceRequestSchema.parse(request)).toEqual(request);
    expect(drawingGovernanceResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(drawingGovernanceRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(drawingGovernanceRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(drawingGovernanceResultSchema.safeParse({
      ...result,
      requiredPrerequisites: ["canonical-dim-id-policy", "approved-ado-access"],
    }).success).toBe(false);
  });
});

describe("F5 interpretation placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F5",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-knowledge-base"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(interpretationRequestSchema.parse(request)).toEqual(request);
    expect(interpretationResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(interpretationRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(interpretationRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(interpretationResultSchema.safeParse({ ...result, requiredPrerequisites: [] }).success).toBe(false);
  });
});

describe("F6 comparison placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F6",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-knowledge-base"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(comparisonRequestSchema.parse(request)).toEqual(request);
    expect(comparisonResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(comparisonRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(comparisonRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(comparisonResultSchema.safeParse({ ...result, requiredPrerequisites: [] }).success).toBe(false);
  });
});

describe("F7 Cpk placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F7",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-measurement-store"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(cpkRequestSchema.parse(request)).toEqual(request);
    expect(cpkResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(cpkRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(cpkRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(cpkResultSchema.safeParse({ ...result, requiredPrerequisites: [] }).success).toBe(false);
  });
});

describe("F8 public workflow contracts", () => {
  const request = {
    contractVersion: "v1",
    workflowId: "public-smoke",
    inputClassification: "public",
    message: "anonymous smoke message",
  };

  const result = {
    contractVersion: "v1",
    workflowId: "public-smoke",
    outputClassification: "public",
    runId: "00000000-0000-4000-8000-000000000001",
    manifestValid: true,
    executedSkillIds: ["public-echo", "classification-check"],
  };

  it("accepts the fixed public smoke request and result", () => {
    expect(workflowRequestSchema.parse(request)).toEqual(request);
    expect(workflowResultSchema.parse(result)).toEqual(result);
  });

  it("rejects non-public input, unknown fields, invalid messages, and altered skill order", () => {
    expect(workflowRequestSchema.safeParse({ ...request, inputClassification: "confidential" }).success).toBe(false);
    expect(workflowRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(workflowRequestSchema.safeParse({ ...request, message: " " }).success).toBe(false);
    expect(workflowResultSchema.safeParse({ ...result, executedSkillIds: ["classification-check", "public-echo"] }).success).toBe(false);
  });
});

describe("knowledge-base contracts", () => {
  const publicManifest = {
    contractVersion: "v1",
    knowledgeBaseVersion: "v1",
    classification: "public",
    releasedAt: "2026-07-22",
    changeSummary: "Public knowledge-base manifest for capability discovery.",
    libraries: [
      {
        libraryId: "capability-library",
        contractId: "capability-library-v1",
        entryCount: 1,
        coverage: ["demo-bracket"],
        contentHash: "a".repeat(64),
      },
      {
        libraryId: "capability-item-mapping",
        contractId: "capability-item-mapping-v1",
        entryCount: 2,
        coverage: ["public demo coverage"],
        contentHash: "d".repeat(64),
      },
      {
        libraryId: "engineering-rules",
        contractId: "engineering-rules-v1",
        entryCount: 3,
        coverage: ["sigma", "cpk"],
        contentHash: "b".repeat(64),
      },
      {
        libraryId: "terminology-ontology",
        contractId: "terminology-ontology-v1",
        entryCount: 2,
        coverage: ["part-category", "datum"],
        contentHash: "c".repeat(64),
      },
    ],
  };

  it("accepts a public v1 knowledge-base manifest", () => {
    expect(knowledgeBaseManifestSchema.parse(publicManifest).classification).toBe("public");
  });

  it("rejects a manifest with a duplicate library ID", () => {
    expect(() =>
      knowledgeBaseManifestSchema.parse({
        ...publicManifest,
        libraries: [
          publicManifest.libraries[0],
          publicManifest.libraries[0],
          publicManifest.libraries[2],
          publicManifest.libraries[3],
        ],
      }),
    ).toThrow();
  });

  it("rejects a manifest whose library has a mismatched contract ID", () => {
    expect(() =>
      knowledgeBaseManifestSchema.parse({
        ...publicManifest,
        libraries: [
          { ...publicManifest.libraries[0], contractId: "engineering-rules-v1" },
          publicManifest.libraries[1],
          publicManifest.libraries[2],
          publicManifest.libraries[3],
        ],
      }),
    ).toThrow();
  });

  it("rejects unsupported tiers and non-public manifests", () => {
    expect(() => capabilityTierSchema.parse("T4")).toThrow();
    expect(() =>
      knowledgeBaseManifestSchema.parse({
        ...publicManifest,
        classification: "confidential",
      }),
    ).toThrow();
  });

  it("parses a capability entry with public field names", () => {
    expect(
      capabilityEntrySchema.parse({
        entryId: "demo-bracket-capability",
        partCategory: "demo-bracket",
        toleranceMin: 0.1,
        toleranceMax: 0.2,
        unit: "mm",
        recommendedDistribution: "normal",
        capabilityTier: "T1",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["demo-bracket"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      }),
    ).toMatchObject({ partCategory: "demo-bracket", capabilityTier: "T1" });
  });

  it("rejects infinite values in knowledge-base numeric fields", () => {
    const capabilityEntry = {
      entryId: "demo-bracket-capability",
      partCategory: "demo-bracket",
      toleranceMin: 0.1,
      toleranceMax: 0.2,
      unit: "mm" as const,
      recommendedDistribution: "normal" as const,
      capabilityTier: "T1" as const,
      provenance: {
        source: "fixture",
        confidence: 1,
        owner: "contracts-test",
        coverage: ["demo-bracket"],
        effectiveVersion: "v1" as const,
        changeSummary: "Initial fixture.",
      },
    };

    for (const infiniteValue of [Infinity, -Infinity]) {
      expect(
        capabilityEntrySchema.safeParse({
          ...capabilityEntry,
          provenance: { ...capabilityEntry.provenance, confidence: infiniteValue },
        }).success,
      ).toBe(false);
      expect(
        capabilityEntrySchema.safeParse({ ...capabilityEntry, toleranceMin: infiniteValue }).success,
      ).toBe(false);
      expect(
        capabilityEntrySchema.safeParse({ ...capabilityEntry, toleranceMax: infiniteValue }).success,
      ).toBe(false);
      expect(
        engineeringRuleEntrySchema.safeParse({
          ruleId: "cts-sigma",
          ruleType: "sigma",
          threshold: infiniteValue,
          unit: "sigma",
          applicability: "all capability studies",
          provenance: capabilityEntry.provenance,
        }).success,
      ).toBe(false);
      expect(
        knowledgeBaseQueryRequestSchema.safeParse({
          partCategory: "demo-bracket",
          tolerance: infiniteValue,
          unit: "mm",
        }).success,
      ).toBe(false);
    }
  });

  it("defaults omitted terminology aliases to an empty array", () => {
    expect(
      terminologyEntrySchema.parse({
        entryId: "demo-bracket",
        termType: "part-category",
        canonicalName: "Demo Bracket",
        definition: "A bracket used by contract fixtures.",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["demo-bracket"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      }).aliases,
    ).toEqual([]);
  });

  it("accepts empty terminology aliases", () => {
    expect(
      terminologyEntrySchema.parse({
        entryId: "demo-bracket",
        termType: "part-category",
        canonicalName: "Demo Bracket",
        aliases: [],
        definition: "A bracket used by contract fixtures.",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["demo-bracket"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      }).aliases,
    ).toEqual([]);
  });

  it("validates capability queries", () => {
    expect(
      knowledgeBaseQueryRequestSchema.parse({
        partCategory: "demo-bracket",
        tolerance: 0.2,
        unit: "mm",
      }),
    ).toMatchObject({ partCategory: "demo-bracket", tolerance: 0.2, unit: "mm" });
    expect(() =>
      knowledgeBaseQueryRequestSchema.parse({
        partCategory: "",
        tolerance: 0.2,
        unit: "mm",
      }),
    ).toThrow();
    expect(() =>
      knowledgeBaseQueryRequestSchema.parse({
        partCategory: "demo-bracket",
        tolerance: -0.1,
        unit: "mm",
      }),
    ).toThrow();
  });

  it("accepts unknown nonempty engineering rule IDs while rejecting malformed queries", () => {
    expect(engineeringRuleQuerySchema.parse({ ruleId: "not-a-rule" })).toEqual({
      ruleId: "not-a-rule",
    });
    expect(() => engineeringRuleQuerySchema.parse({ ruleId: "" })).toThrow();
    expect(() => engineeringRuleQuerySchema.parse({})).toThrow();
    expect(() => engineeringRuleQuerySchema.parse({ ruleId: "cts-sigma", extra: true })).toThrow();
  });

  it("rejects an engineering rule entry with an unknown stored rule ID", () => {
    expect(
      engineeringRuleEntrySchema.safeParse({
        ruleId: "unknown-stored-rule",
        ruleType: "sigma",
        threshold: 3,
        unit: "sigma",
        applicability: "all capability studies",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["sigma"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      }).success,
    ).toBe(false);
  });

  it("validates strict versioned knowledge-base query results", () => {
    const matchedCapability = knowledgeBaseQueryResultSchema.parse({
      queryType: "capability",
      status: "matched",
      contractVersion: "v1",
      knowledgeBaseVersion: "v1",
      entry: {
        entryId: "demo-bracket-capability",
        partCategory: "demo-bracket",
        toleranceMin: 0.1,
        toleranceMax: 0.2,
        unit: "mm",
        recommendedDistribution: "normal",
        capabilityTier: "T1",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["demo-bracket"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      },
    });
    const unknownCapability = {
      queryType: "capability" as const,
      status: "unknown" as const,
      contractVersion: "v1" as const,
      knowledgeBaseVersion: "v1" as const,
      capabilityTier: "T0" as const,
      message: "制程能力未知，请与供应商确认" as const,
    };

    expect(matchedCapability.queryType).toBe("capability");
    expect(knowledgeBaseQueryResultSchema.parse(unknownCapability)).toEqual(unknownCapability);
    expect(() => knowledgeBaseQueryResultSchema.parse({ ...unknownCapability, feasible: true })).toThrow();
  });
});

describe("internal tolerance guidance contracts", () => {
  const sourceMetadata = {
    sourceId: "cnc-capability-matrix-2026-q3",
    sourceFile: "cnc-capability-matrix.xlsx",
    sourceFileHash: "a".repeat(64),
    sourceVersion: "2026-Q3",
    sheetName: "CNC",
    sourceRange: "A1:B2",
    classification: "internal" as const,
  };

  const manifest = {
    contractVersion: "v1" as const,
    knowledgeBaseVersion: "internal-v1" as const,
    classification: "internal" as const,
    releasedAt: "2026-07-28",
    changeSummary: "Initial internal tolerance guidance snapshot.",
    sourceCount: 1,
    entryCount: 6,
    sourcesContentHash: "b".repeat(64),
    entriesContentHash: "c".repeat(64),
  };

  const evidence = {
    sourceFile: "cnc-capability-matrix.xlsx",
    sourceFileHash: "a".repeat(64),
    sheetName: "CNC",
    sourceRange: "A2:H2",
  };

  const entry = {
    entryId: "cnc-hole-diameter",
    processFamily: "cnc-machining",
    featureType: "hole-diameter",
    material: "aluminum",
    nominalRange: { min: 1, max: 25, unit: "mm" },
    maximumRecommendedTotalBand: { value: 0.1, unit: "mm" },
    fallbackPriority: 10,
    capabilityTier: "T1",
    provenance: {
      classification: "internal",
      sourceId: "cnc-capability-matrix-2026-q3",
      ...evidence,
      sourceVersion: "2026-Q3",
      owner: "knowledge-steward",
      confidence: 1,
      effectiveVersion: "internal-v1",
      changeSummary: "Reviewed CNC hole-diameter guidance.",
    },
  };

  const request = {
    processFamily: "cnc-machining",
    featureType: "hole-diameter",
    nominalValue: 12,
    nominalUnit: "mm",
    material: "aluminum",
    tolerance: { representation: "bilateral", value: 0.08, unit: "mm" },
  };

  const exceededResult = {
    status: "guidance-exceeded",
    knowledgeBaseVersion: "internal-v1",
    matchedEntryId: entry.entryId,
    assessedTotalBand: { value: 0.16, unit: "mm" },
    maximumRecommendedTotalBand: entry.maximumRecommendedTotalBand,
    fallbackApplied: false,
    evidence,
  };

  it("accepts a CNC bilateral request and guidance-exceeded DTO", () => {
    expect(internalToleranceGuidanceRequestSchema.parse(request)).toEqual(request);
    expect(internalToleranceGuidanceEntrySchema.parse(entry)).toEqual(entry);
    expect(internalToleranceGuidanceResultSchema.parse(exceededResult)).toEqual(exceededResult);
  });

  it("accepts strict nested entry and request conditions", () => {
    const conditions = {
      processMethod: "formed",
      materialFamily: "steel",
      thicknessMm: { min: 0.8, max: 1.2 },
      toleranceGrade: "TG6",
      dimensionType: "W" as const,
    };

    expect(internalToleranceGuidanceEntrySchema.parse({ ...entry, conditions }).conditions).toEqual(conditions);
    expect(internalToleranceGuidanceRequestSchema.parse({
      ...request,
      conditions: {
        processMethod: "formed",
        materialFamily: "steel",
        thicknessMm: 1,
        toleranceGrade: "TG6",
        dimensionType: "W",
      },
    }).conditions).toEqual({
      processMethod: "formed",
      materialFamily: "steel",
      thicknessMm: 1,
      toleranceGrade: "TG6",
      dimensionType: "W",
    });

    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      conditions: { dimensionType: "X" },
    }).success).toBe(false);
    expect(internalToleranceGuidanceRequestSchema.safeParse({
      ...request,
      conditions: { thicknessMm: Number.NaN },
    }).success).toBe(false);
    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      conditions: { thicknessMm: { min: 0.8, max: Infinity } },
    }).success).toBe(false);
    expect(internalToleranceGuidanceRequestSchema.safeParse({
      ...request,
      conditions: { dimensionType: "NW", unexpected: true },
    }).success).toBe(false);
  });

  it("accepts explicit range endpoint inclusion flags and rejects empty ranges", () => {
    expect(internalToleranceGuidanceEntrySchema.parse({
      ...entry,
      nominalRange: { min: 3, minInclusive: false, max: 6, maxInclusive: true, unit: "mm" },
      conditions: { thicknessMm: { min: 1, minInclusive: false, max: 3, maxInclusive: true } },
    })).toMatchObject({
      nominalRange: { min: 3, minInclusive: false, max: 6, maxInclusive: true, unit: "mm" },
      conditions: { thicknessMm: { min: 1, minInclusive: false, max: 3, maxInclusive: true } },
    });
    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      nominalRange: { min: 6, minInclusive: false, max: 6, maxInclusive: true, unit: "mm" },
    }).success).toBe(false);
    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      conditions: { thicknessMm: { min: 3, minInclusive: false, max: 3, maxInclusive: true } },
    }).success).toBe(false);
    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      nominalRange: { min: 3, minInclusive: "false", max: 6, unit: "mm" },
    }).success).toBe(false);
  });

  it("accepts strict internal-v1 source metadata and manifest", () => {
    expect(internalToleranceGuidanceSourceMetadataSchema.parse(sourceMetadata)).toEqual(sourceMetadata);
    expect(internalToleranceGuidanceManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it.each([
    ["source metadata", internalToleranceGuidanceSourceMetadataSchema, sourceMetadata],
    ["manifest", internalToleranceGuidanceManifestSchema, manifest],
  ])("rejects an extra field in internal-v1 %s", (_description, schema, value) => {
    expect(schema.safeParse({ ...value, unexpected: true }).success).toBe(false);
  });

  it.each([
    ["source metadata", internalToleranceGuidanceSourceMetadataSchema, sourceMetadata],
    ["manifest", internalToleranceGuidanceManifestSchema, manifest],
  ])("rejects public classification in internal-v1 %s", (_description, schema, value) => {
    expect(schema.safeParse({ ...value, classification: "public" }).success).toBe(false);
  });

  it.each([
    ["source metadata hash", internalToleranceGuidanceSourceMetadataSchema, { ...sourceMetadata, sourceFileHash: "A".repeat(64) }],
    ["source metadata range", internalToleranceGuidanceSourceMetadataSchema, { ...sourceMetadata, sourceRange: "A0:B2" }],
    ["manifest sources count", internalToleranceGuidanceManifestSchema, { ...manifest, sourceCount: -1 }],
    ["manifest entries count", internalToleranceGuidanceManifestSchema, { ...manifest, entryCount: 1.5 }],
    ["manifest sources hash", internalToleranceGuidanceManifestSchema, { ...manifest, sourcesContentHash: "B".repeat(64) }],
    ["manifest entries hash", internalToleranceGuidanceManifestSchema, { ...manifest, entriesContentHash: "C".repeat(64) }],
  ])("rejects invalid internal-v1 %s", (_description, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["public provenance", { ...entry, provenance: { ...entry.provenance, classification: "public" } }],
    ["an unsupported process", { ...entry, processFamily: "laser-cutting" }],
    ["a zero maximum threshold", { ...entry, maximumRecommendedTotalBand: { value: 0, unit: "mm" } }],
    ["absent evidence range", { ...entry, provenance: { ...entry.provenance, sourceRange: undefined } }],
    ["a malformed evidence range", { ...entry, provenance: { ...entry.provenance, sourceRange: "A0:B2" } }],
    ["an extra field", { ...entry, unexpected: true }],
  ])("rejects an entry with %s", (_description, invalidEntry) => {
    expect(internalToleranceGuidanceEntrySchema.safeParse(invalidEntry).success).toBe(false);
  });

  it("requires upper and lower values for unilateral tolerance", () => {
    expect(
      internalToleranceGuidanceRequestSchema.safeParse({
        ...request,
        tolerance: { representation: "unilateral", value: 0.1, unit: "mm", upperValue: 0.1 },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["equal", 0.1, 0.1],
    ["reversed", 0.05, 0.1],
  ])("rejects %s unilateral tolerance values", (_description, upperValue, lowerValue) => {
    expect(
      internalToleranceGuidanceRequestSchema.safeParse({
        ...request,
        tolerance: { representation: "unilateral", value: 0.1, unit: "mm", upperValue, lowerValue },
      }).success,
    ).toBe(false);
  });

  it("rejects a unilateral tolerance whose value does not equal the total band", () => {
    expect(
      internalToleranceGuidanceRequestSchema.safeParse({
        ...request,
        tolerance: { representation: "unilateral", value: 0.1, unit: "mm", upperValue: 0.2, lowerValue: 0.05 },
      }).success,
    ).toBe(false);
  });

  it.each(["pass", "fail", "feasible", "tooTight"])("rejects unsupported output field %s", (field) => {
    expect(
      internalToleranceGuidanceResultSchema.safeParse({ ...exceededResult, [field]: true }).success,
    ).toBe(false);
  });
});

describe("workbook catalog contracts", () => {
  const confidentialRequest = {
    contractVersion: "v1",
    fileName: "anonymous-ta.xlsx",
    inputClassification: "confidential",
    workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
  };

  const confidentialResult = {
    contractVersion: "v1",
    workbook: {
      fileName: "anonymous-ta.xlsx",
      classification: "confidential",
      contentHash: "a".repeat(64),
      metadata: {
        documentNo: "TA-001",
        revision: "A",
        date: {
          value: "2026-07-23",
          formula: "=TODAY()",
          sourceCell: "Title Page!B6",
        },
      },
    },
    analyses: [
      {
        worksheetName: "Auto Summary",
        toleranceLoopDescription: "Cataloged tolerance analysis.",
        source: {
          summarySheet: "Auto Summary",
          summaryRow: 1,
          worksheetAnchor: "Auto Summary!A1",
        },
      },
    ],
  };

  it("accepts a confidential workbook catalog request", () => {
    expect(workbookCatalogRequestSchema.parse(confidentialRequest)).toEqual(confidentialRequest);
  });

  it("accepts an approved confidential workbook catalog result", () => {
    expect(workbookCatalogResultSchema.parse(confidentialResult)).toEqual(confidentialResult);
  });

  it.each([
    ["a Windows path", { ...confidentialRequest, fileName: "C:\\private\\anonymous-ta.xlsx" }],
    ["a traversal path", { ...confidentialRequest, fileName: "../anonymous-ta.xlsx" }],
    ...["safe\u0000.xlsx", "safe\u000b.xlsx", "safe\u007f.xlsx", "safe\u2028.xlsx", "safe\u2029.xlsx"].map(
      (fileName) => ["a filename with a control character", { ...confidentialRequest, fileName }] as const,
    ),
    ["a public classification", { ...confidentialRequest, inputClassification: "public" }],
    ["empty workbook bytes", { ...confidentialRequest, workbookBytes: new Uint8Array() }],
    ["an extra field", { ...confidentialRequest, unexpected: true }],
  ])("rejects a request with %s", (_description, request) => {
    expect(workbookCatalogRequestSchema.safeParse(request).success).toBe(false);
  });

  it.each(["Auto Summary!A12", "Auto Summary!A1-extra"])(
    "rejects a result with a malformed worksheet anchor: %s",
    (worksheetAnchor) => {
      expect(
        workbookCatalogResultSchema.safeParse({
          ...confidentialResult,
          analyses: [
            {
              ...confidentialResult.analyses[0],
              source: { ...confidentialResult.analyses[0].source, worksheetAnchor },
            },
          ],
        }).success,
      ).toBe(false);
    },
  );

  it("rejects a result with unknown raw fields", () => {
    expect(
      workbookCatalogResultSchema.safeParse({
        ...confidentialResult,
        workbook: { ...confidentialResult.workbook, rawWorkbookXml: "<workbook />" },
      }).success,
    ).toBe(false);
  });

  it("rejects a result with a non-confidential classification", () => {
    expect(
      workbookCatalogResultSchema.safeParse({
        ...confidentialResult,
        workbook: { ...confidentialResult.workbook, classification: "internal" },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["legacy worksheet", { worksheet: "Auto Summary" }],
    ["legacy description", { description: "Cataloged tolerance analysis." }],
    [
      "an analysis-level date",
      {
        date: {
          value: "2026-07-23",
          sourceCell: "Title Page!B6",
        },
      },
    ],
  ])("rejects a result with %s", (_description, legacyFields) => {
    expect(
      workbookCatalogResultSchema.safeParse({
        ...confidentialResult,
        analyses: [{ ...confidentialResult.analyses[0], ...legacyFields }],
      }).success,
    ).toBe(false);
  });
});

describe("worksheet analysis asset contracts", () => {
  const contentHash = "a".repeat(64);
  const workbookCatalog = {
    contractVersion: "v1",
    workbook: {
      fileName: "anonymous-ta.xlsx",
      classification: "confidential",
      contentHash,
      metadata: {
        documentNo: "TA-001",
        revision: "A",
        date: { value: "2026-07-24", sourceCell: "Title Page!B6" },
      },
    },
    analyses: [
      {
        worksheetName: "Analysis",
        toleranceLoopDescription: "Anonymous analysis.",
        source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis!A1" },
      },
    ],
  };

  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
    workbookCatalog,
  };

  const result = {
    contractVersion: "v1",
    workbook: { classification: "confidential", contentHash, catalogContractVersion: "v1" },
    worksheets: [
      {
        worksheetName: "Analysis",
        toleranceLoopDescription: "Anonymous analysis.",
        factorTables: [
          {
            tableId: "table-a",
            headerRow: 12,
            dataRange: { startRow: 13, endRow: 13 },
            columns: [{ semanticField: "factorName", headerText: "Factor", sourceColumn: "B" }],
            rows: [
              {
                sourceRow: 13,
                fields: {
                  factorName: {
                    status: "available",
                    rawText: "Anonymous factor",
                    sourceCell: "Analysis!B13",
                    numericValue: 1.25,
                    unit: "mm",
                    formula: "=B12",
                    cachedValue: "1.25",
                  },
                  nominalValue: { status: "unavailable", reasonCode: "missing", sourceCell: "Analysis!C13" },
                },
              },
            ],
          },
        ],
        formulaCells: [
          {
            sourceCell: "Analysis!K13",
            formula: "=B13",
            cachedValue: { status: "available", rawText: "1.25" },
          },
        ],
        imageAssets: [
          {
            contentHash,
            mediaType: "image/png",
            byteLength: 12,
            sourcePart: "xl/media/image1.png",
            drawingSourcePart: "xl/drawings/drawing1.xml",
            anchor: { status: "available", from: "C3", to: "K20" },
          },
        ],
      },
    ],
  };

  it("accepts confidential v1 worksheet analysis asset contracts", () => {
    expect(worksheetAnalysisAssetsRequestSchema.parse(request)).toEqual(request);
    expect(worksheetAnalysisAssetsRequestSchema.parse({ ...request, worksheetSelection: { mode: "all" } }).worksheetSelection).toEqual({ mode: "all" });
    expect(worksheetAnalysisAssetsRequestSchema.parse({ ...request, worksheetSelection: { mode: "selected", worksheetNames: ["Analysis"] } }).worksheetSelection).toEqual({ mode: "selected", worksheetNames: ["Analysis"] });
    expect(worksheetAnalysisAssetsResultSchema.parse(result)).toEqual(result);
    expect(
      worksheetImageReadRequestSchema.parse({
        contractVersion: "v1",
        inputClassification: "confidential",
        workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
        workbookContentHash: contentHash,
        imageContentHash: "b".repeat(64),
      }),
    ).toMatchObject({ workbookContentHash: contentHash });
    expect(
      worksheetImageReadResultSchema.parse({
        contractVersion: "v1",
        classification: "confidential",
        workbookContentHash: contentHash,
        imageContentHash: "b".repeat(64),
        mediaType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
      }).bytes,
    ).toEqual(new Uint8Array([1, 2, 3]));
  });

  it.each([
    ["a public input", { ...request, inputClassification: "public" }],
    ["an uppercase hash", { ...result, workbook: { ...result.workbook, contentHash: "A".repeat(64) } }],
    ["an invalid hash", { ...result, workbook: { ...result.workbook, contentHash: "not-a-hash" } }],
    ["an extra field", { ...request, unexpected: true }],
    ["an empty selected worksheet list", { ...request, worksheetSelection: { mode: "selected", worksheetNames: [] } }],
    ["duplicate selected worksheet names", { ...request, worksheetSelection: { mode: "selected", worksheetNames: ["Analysis", "Analysis"] } }],
  ])("rejects worksheet assets with %s", (_description, value) => {
    const schema = "workbook" in value ? worksheetAnalysisAssetsResultSchema : worksheetAnalysisAssetsRequestSchema;
    expect(schema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["workbookContentHash", { imageContentHash: contentHash }],
    ["imageContentHash", { workbookContentHash: contentHash }],
  ])("rejects an image read request missing %s", (_missingField, hashes) => {
    expect(
      worksheetImageReadRequestSchema.safeParse({
        contractVersion: "v1",
        inputClassification: "confidential",
        workbookBytes: new Uint8Array([0x50]),
        ...hashes,
      }).success,
    ).toBe(false);
  });

  it("rejects raw text leaked through an unavailable field", () => {
    expect(
      worksheetAnalysisAssetsResultSchema.safeParse({
        ...result,
        worksheets: [
          {
            ...result.worksheets[0],
            factorTables: [
              {
                ...result.worksheets[0].factorTables[0],
                rows: [
                  {
                    ...result.worksheets[0].factorTables[0].rows[0],
                    fields: {
                      factorName: {
                        status: "unavailable",
                        reasonCode: "invalid_format",
                        rawText: "must not leak",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires a cached value for an available formula field", () => {
    expect(
      worksheetAnalysisAssetsResultSchema.safeParse({
        ...result,
        worksheets: [{
          ...result.worksheets[0],
          factorTables: [{
            ...result.worksheets[0].factorTables[0],
            rows: [{
              ...result.worksheets[0].factorTables[0].rows[0],
              fields: {
                factorName: {
                  status: "available",
                  rawText: "Anonymous factor",
                  sourceCell: "Analysis!B13",
                  formula: "=A1",
                },
              },
            }],
          }],
        }],
      }).success,
    ).toBe(false);
  });

  it("retains an independent formula cell when its cached value is unavailable", () => {
    expect(
      worksheetAnalysisAssetsResultSchema.safeParse({
        ...result,
        worksheets: [{
          ...result.worksheets[0],
          formulaCells: [{
            sourceCell: "Analysis!K13",
            formula: "=B13",
            cachedValue: { status: "unavailable", reasonCode: "missing_cached_value" },
          }],
        }],
      }).success,
    ).toBe(true);
  });

  it("accepts an unavailable image anchor without guessing coordinates", () => {
    expect(
      worksheetAnalysisAssetsResultSchema.safeParse({
        ...result,
        worksheets: [{
          ...result.worksheets[0],
          imageAssets: [{
            ...result.worksheets[0].imageAssets[0],
            anchor: { status: "unavailable", reasonCode: "unparsed_anchor" },
          }],
        }],
      }).success,
    ).toBe(true);
  });

  it("accepts the controlled application/octet-stream image fallback", () => {
    expect(
      worksheetImageReadResultSchema.safeParse({
        contractVersion: "v1",
        classification: "confidential",
        workbookContentHash: "a".repeat(64),
        imageContentHash: "b".repeat(64),
        mediaType: "application/octet-stream",
        bytes: new Uint8Array([1]),
      }).success,
    ).toBe(true);
  });

  it("accepts the F2.1 semantic fields and strict required-field check contracts", () => {
    const assets = {
      ...result,
      worksheets: [{
        ...result.worksheets[0],
        factorTables: [{
          ...result.worksheets[0]!.factorTables[0],
          columns: [
            { semanticField: "partName", headerText: "Part Name", sourceColumn: "C" },
            { semanticField: "partCategory", headerText: "Part Category", sourceColumn: "D" },
            { semanticField: "longTermSafetyFactor", headerText: "Safety Factor", sourceColumn: "E" },
            { semanticField: "drawingNumber", headerText: "Drawing Number", sourceColumn: "F" },
            { semanticField: "dimCharacteristicId", headerText: "DIM ID", sourceColumn: "G" },
          ],
          rows: [],
          dataRange: { startRow: 13, endRow: 13 },
        }],
      }],
    };

    expect(requiredFieldCheckRequestSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      worksheetAnalysisAssets: assets,
    }).worksheetAnalysisAssets).toEqual(assets);
    expect(requiredFieldCheckResultSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: contentHash,
      status: "blocked",
      blockingIssues: [{
        issueCode: "required_field_unavailable",
        worksheetName: "Analysis",
        tableId: "table-a",
        sourceRow: 13,
        field: "longTermSafetyFactor",
        reasonCode: "missing",
      }],
      advisoryIssues: [{
        issueCode: "optional_identifier_unavailable",
        worksheetName: "Analysis",
        tableId: "table-a",
        sourceRow: 13,
        field: "dimCharacteristicId",
        reasonCode: "missing",
      }],
      summary: {
        worksheetsChecked: 1,
        factorTablesChecked: 1,
        factorRowsChecked: 1,
        blockingIssueCount: 1,
        advisoryIssueCount: 1,
      },
    }).status).toBe("blocked");
  });

  it("rejects F2.1 state and count inconsistencies", () => {
    const result = {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: contentHash,
      status: "readyForNextCheck",
      blockingIssues: [{ issueCode: "factor_table_has_no_rows", worksheetName: "Analysis", tableId: "table-a" }],
      advisoryIssues: [],
      summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 0, blockingIssueCount: 1, advisoryIssueCount: 0 },
    };

    expect(requiredFieldCheckResultSchema.safeParse(result).success).toBe(false);
    expect(requiredFieldCheckResultSchema.safeParse({
      ...result,
      status: "blocked",
      summary: { ...result.summary, blockingIssueCount: 0 },
    }).success).toBe(false);
    expect(requiredFieldCheckResultSchema.safeParse({ ...result, unexpected: true }).success).toBe(false);
  });

  it("accepts strict F2.2 gates while rejecting gate rows", () => {
    const requiredFieldCheck = requiredFieldCheckResultSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: contentHash,
      status: "readyForNextCheck",
      blockingIssues: [],
      advisoryIssues: [],
      summary: {
        worksheetsChecked: 1,
        factorTablesChecked: 1,
        factorRowsChecked: 1,
        blockingIssueCount: 0,
        advisoryIssueCount: 0,
      },
    });

    expect(capabilityValidationRequestSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: "v1",
      worksheetAnalysisAssets: result,
      requiredFieldCheck,
    }).knowledgeBaseVersion).toBe("v1");

    const gateResult = {
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: "v1",
      workbookContentHash: contentHash,
      status: "required_fields_not_ready",
      rows: [],
      summary: {
        factorRowsChecked: 0,
        inLibraryCount: 0,
        outOfLibraryCount: 0,
        toleranceUnableToValidateCount: 0,
        distributionMatchCount: 0,
        distributionMismatchCount: 0,
        distributionUnableToValidateCount: 0,
        distributionNotApplicableCount: 0,
      },
    };

    expect(capabilityValidationResultSchema.parse(gateResult).status).toBe("required_fields_not_ready");
    expect(capabilityValidationResultSchema.safeParse({
      ...gateResult,
      rows: [{ worksheetName: "Analysis" }],
    }).success).toBe(false);
  });

  it("permits the canonical zero-row table range but rejects an inverted range", () => {
    const zeroRowTable = {
      ...result.worksheets[0]!.factorTables[0],
      dataRange: { startRow: 13, endRow: 13 },
      rows: [],
    };
    const zeroRowAssets = {
      ...result,
      worksheets: [{ ...result.worksheets[0], factorTables: [zeroRowTable] }],
    };

    expect(worksheetAnalysisAssetsResultSchema.safeParse(zeroRowAssets).success).toBe(true);
    expect(worksheetAnalysisAssetsResultSchema.safeParse({
      ...zeroRowAssets,
      worksheets: [{
        ...zeroRowAssets.worksheets[0],
        factorTables: [{ ...zeroRowTable, dataRange: { startRow: 13, endRow: 12 } }],
      }],
    }).success).toBe(false);
  });

  it("accepts completed F2.2 evidence for F2.3 while enforcing resolution status invariants", () => {
    const completedCapabilityValidation = {
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: "v1",
      workbookContentHash: contentHash,
      status: "completed",
      rows: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
        factorName: "anonymous-factor",
        tolerance: { status: "out_of_library", totalTolerance: 0.2, unit: "mm" },
        distribution: { status: "not_applicable" },
      }],
      summary: {
        factorRowsChecked: 1,
        inLibraryCount: 0,
        outOfLibraryCount: 1,
        toleranceUnableToValidateCount: 0,
        distributionMatchCount: 0,
        distributionMismatchCount: 0,
        distributionUnableToValidateCount: 0,
        distributionNotApplicableCount: 1,
      },
    };
    const signalRef = `${contentHash}|Analysis-A|table-a|2|tolerance_out_of_library`;

    expect(exceptionResolutionRequestSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      capabilityValidation: completedCapabilityValidation,
      candidates: [{
        signalRef,
        recordedBy: "anonymous-engineer",
        recordedAt: "2026-07-27T10:15:30.000Z",
        rationale: "Anonymous evidence reviewed.",
      }],
    }).candidates).toHaveLength(1);

    expect(exceptionResolutionRequestSchema.safeParse({
      contractVersion: "v1",
      inputClassification: "confidential",
      capabilityValidation: { ...completedCapabilityValidation, status: "required_fields_not_ready", rows: [], summary: {
        ...completedCapabilityValidation.summary,
        factorRowsChecked: 0,
        outOfLibraryCount: 0,
        distributionNotApplicableCount: 0,
      } },
      candidates: [],
    }).success).toBe(false);

    const result = {
      contractVersion: "v1",
      inputClassification: "confidential",
      status: "readyToContinue",
      readyToContinue: true,
      workbookContentHash: contentHash,
      knowledgeBaseVersion: "v1",
      acceptedExceptions: [{
        signalRef,
        recordedBy: "anonymous-engineer",
        recordedAt: "2026-07-27T10:15:30.000Z",
        rationale: "Anonymous evidence reviewed.",
        snapshot: {
          signalKind: "tolerance_out_of_library",
          worksheetName: "Analysis-A",
          tableId: "table-a",
          sourceRow: 2,
          factorName: "anonymous-factor",
          signal: { status: "out_of_library", totalTolerance: 0.2, unit: "mm" },
        },
      }],
      pendingExceptions: [],
      summary: {
        actionableSignalCount: 1,
        acceptedExceptionCount: 1,
        pendingExceptionCount: 0,
        invalidCandidateCount: 0,
      },
    };

    expect(exceptionResolutionResultSchema.parse(result).status).toBe("readyToContinue");
    expect(exceptionResolutionResultSchema.safeParse({ ...result, readyToContinue: false }).success).toBe(false);
  });

  it("accepts strict F1.7 semantic table detection contracts", () => {
    const detectionRequest = {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis"] },
      manualConfirmations: [{
        worksheetName: "Analysis",
        candidateId: "cand-a",
        action: "confirm_as_is",
      }],
    };

    expect(semanticTableDetectionRequestSchema.parse(detectionRequest)).toEqual(detectionRequest);

    const pendingResult = {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbook: { contentHash, catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName: "Analysis",
        recognitionStatus: "pending_confirmation",
        confidenceScore: 71,
        confidenceBreakdown: {
          headerScore: 36,
          typeScore: 20,
          completenessScore: 15,
          penalty: 0,
        },
        uncertaintyReasons: ["ambiguous_mapping"],
        requiresUserConfirmation: true,
        confirmationPayload: {
          candidateId: "cand-a",
          headerRow: 12,
          dataRange: { startRow: 13, endRow: 26 },
          mappedFields: [{
            field: "factorName",
            sourceColumn: "B",
            headerText: "Factor",
            status: "mapped",
          }],
          recommendedAction: "confirm_as_is",
          reasonCodes: ["ambiguous_mapping"],
        },
      }],
      summary: {
        worksheetCount: 1,
        autoConfirmedCount: 0,
        manualConfirmedCount: 0,
        pendingConfirmationCount: 1,
        blockedCount: 0,
      },
    };

    expect(semanticTableDetectionResultSchema.parse(pendingResult)).toEqual(pendingResult);
    expect(semanticTableDetectionResultSchema.safeParse({
      ...pendingResult,
      worksheets: [{
        ...pendingResult.worksheets[0],
        recognitionStatus: "auto_confirmed",
        requiresUserConfirmation: false,
        confirmationPayload: undefined,
      }],
      summary: {
        worksheetCount: 1,
        autoConfirmedCount: 1,
        manualConfirmedCount: 0,
        pendingConfirmationCount: 0,
        blockedCount: 0,
      },
    }).success).toBe(true);
    expect(semanticTableDetectionResultSchema.safeParse({
      ...pendingResult,
      worksheets: [{
        ...pendingResult.worksheets[0],
        requiresUserConfirmation: false,
      }],
    }).success).toBe(false);
    expect(semanticTableDetectionResultSchema.safeParse({
      ...pendingResult,
      summary: {
        ...pendingResult.summary,
        pendingConfirmationCount: 0,
      },
    }).success).toBe(false);
  });
});

describe("F2.4 identifier quality contracts", () => {
  const contentHash = "a".repeat(64);
  const worksheetAnalysisAssets = {
    contractVersion: "v1" as const,
    workbook: { classification: "confidential" as const, contentHash, catalogContractVersion: "v1" as const },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous analysis.",
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 3 },
        columns: [{ semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" }],
        rows: [],
      }],
      formulaCells: [],
      imageAssets: [],
    }],
  };
  const requiredFieldCheck = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    workbookContentHash: contentHash,
    status: "readyForNextCheck" as const,
    blockingIssues: [],
    advisoryIssues: [],
    summary: {
      worksheetsChecked: 1,
      factorTablesChecked: 1,
      factorRowsChecked: 2,
      blockingIssueCount: 0,
      advisoryIssueCount: 0,
    },
  };

  it("accepts strict confidential F2.4 evidence and aggregated unavailable signals", () => {
    expect(identifierQualityCheckRequestSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      worksheetAnalysisAssets,
      requiredFieldCheck,
    }).requiredFieldCheck.status).toBe("readyForNextCheck");

    expect(identifierQualityCheckResultSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: contentHash,
      status: "completed",
      signals: [{
        signalKind: "identifier_evidence_unavailable",
        worksheetName: "Analysis-A",
        tableId: "table-a",
        field: "dimCharacteristicId",
        reasonCode: "missing",
        sourceRows: [2, 3],
      }],
      summary: {
        factorRowsChecked: 2,
        actionableSignalCount: 1,
        identifierMissingCount: 0,
        identifierEvidenceUnavailableCount: 1,
        identifierTextInvalidCount: 0,
        dimIdDuplicateCount: 0,
      },
    }).status).toBe("completed");
  });

  it("rejects incompatible evidence, invalid signal shapes, and nonempty gate summaries", () => {
    const request = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      worksheetAnalysisAssets,
      requiredFieldCheck,
    };
    const gateResult = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      workbookContentHash: contentHash,
      status: "required_fields_not_ready" as const,
      signals: [],
      summary: {
        factorRowsChecked: 0,
        actionableSignalCount: 0,
        identifierMissingCount: 0,
        identifierEvidenceUnavailableCount: 0,
        identifierTextInvalidCount: 0,
        dimIdDuplicateCount: 0,
      },
    };

    expect(identifierQualityCheckRequestSchema.safeParse({
      ...request,
      requiredFieldCheck: { ...requiredFieldCheck, workbookContentHash: "b".repeat(64) },
    }).success).toBe(false);
    expect(identifierQualityCheckRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(identifierQualityCheckResultSchema.safeParse({
      ...gateResult,
      summary: { ...gateResult.summary, factorRowsChecked: 1 },
    }).success).toBe(false);
    expect(identifierQualityCheckResultSchema.safeParse({
      ...gateResult,
      status: "completed",
      signals: [{
        signalKind: "identifier_evidence_unavailable",
        worksheetName: "Analysis-A",
        tableId: "table-a",
        field: "drawingNumber",
        sourceRows: [3, 2, 2],
      }],
      summary: {
        factorRowsChecked: 2,
        actionableSignalCount: 1,
        identifierMissingCount: 0,
        identifierEvidenceUnavailableCount: 1,
        identifierTextInvalidCount: 0,
        dimIdDuplicateCount: 0,
      },
    }).success).toBe(false);
  });
});

describe("F2.3 v2 unified exception resolution contracts", () => {
  const contentHash = "a".repeat(64);
  const capabilityValidation = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    knowledgeBaseVersion: "v1" as const,
    workbookContentHash: contentHash,
    status: "completed" as const,
    rows: [{
      worksheetName: "Analysis-A",
      tableId: "table-a",
      sourceRow: 2,
      factorName: "anonymous-factor",
      tolerance: { status: "out_of_library" as const, totalTolerance: 0.2, unit: "mm" as const },
      distribution: { status: "not_applicable" as const },
    }],
    summary: {
      factorRowsChecked: 1,
      inLibraryCount: 0,
      outOfLibraryCount: 1,
      toleranceUnableToValidateCount: 0,
      distributionMatchCount: 0,
      distributionMismatchCount: 0,
      distributionUnableToValidateCount: 0,
      distributionNotApplicableCount: 1,
    },
  };
  const identifierQualityCheck = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    workbookContentHash: contentHash,
    status: "completed" as const,
    signals: [{
      signalKind: "identifier_missing" as const,
      worksheetName: "Analysis-A",
      tableId: "table-a",
      field: "drawingNumber" as const,
      sourceRows: [2],
    }],
    summary: {
      factorRowsChecked: 1,
      actionableSignalCount: 1,
      identifierMissingCount: 1,
      identifierEvidenceUnavailableCount: 0,
      identifierTextInvalidCount: 0,
      dimIdDuplicateCount: 0,
    },
  };
  const capabilitySignalRef = `${contentHash}|capability_validation|Analysis-A|table-a|2|tolerance_out_of_library`;
  const identifierSignalRef = `${contentHash}|identifier_quality|Analysis-A|table-a|drawingNumber|identifier_missing|`;

  it("accepts complete F2.2 and F2.4 evidence and source-attributed unified results", () => {
    expect(unifiedExceptionResolutionV2RequestSchema.parse({
      contractVersion: "v2",
      inputClassification: "confidential",
      capabilityValidation,
      identifierQualityCheck,
      candidates: [{
        signalRef: capabilitySignalRef,
        recordedBy: "anonymous-engineer",
        recordedAt: "2026-07-27T10:15:30.000Z",
        rationale: "Anonymous evidence reviewed.",
      }],
    }).contractVersion).toBe("v2");

    expect(unifiedExceptionResolutionV2ResultSchema.parse({
      contractVersion: "v2",
      inputClassification: "confidential",
      status: "readyToContinue",
      readyToContinue: true,
      workbookContentHash: contentHash,
      knowledgeBaseVersion: "v1",
      acceptedExceptions: [
        {
          signalRef: capabilitySignalRef,
          recordedBy: "anonymous-engineer",
          recordedAt: "2026-07-27T10:15:30.000Z",
          rationale: "Anonymous evidence reviewed.",
          snapshot: {
            source: "capability_validation",
            signalKind: "tolerance_out_of_library",
            worksheetName: "Analysis-A",
            tableId: "table-a",
            sourceRow: 2,
            factorName: "anonymous-factor",
            signal: { status: "out_of_library", totalTolerance: 0.2, unit: "mm" },
          },
        },
        {
          signalRef: identifierSignalRef,
          recordedBy: "anonymous-engineer",
          recordedAt: "2026-07-27T10:15:30.000Z",
          rationale: "Anonymous evidence reviewed.",
          snapshot: {
            source: "identifier_quality",
            signalKind: "identifier_missing",
            worksheetName: "Analysis-A",
            tableId: "table-a",
            field: "drawingNumber",
            sourceRows: [2],
          },
        },
      ],
      pendingExceptions: [],
      summary: {
        actionableSignalCount: 2,
        capabilitySignalCount: 1,
        identifierSignalCount: 1,
        acceptedExceptionCount: 2,
        acceptedCapabilityExceptionCount: 1,
        acceptedIdentifierExceptionCount: 1,
        pendingExceptionCount: 0,
        pendingCapabilityExceptionCount: 0,
        pendingIdentifierExceptionCount: 0,
        invalidCandidateCount: 0,
      },
    }).status).toBe("readyToContinue");
  });
});

describe("worksheet selection view contracts", () => {
  const workbookCatalog = {
    contractVersion: "v1",
    workbook: {
      fileName: "anonymous-ta.xlsx",
      classification: "confidential",
      contentHash: "a".repeat(64),
      metadata: {
        documentNo: "TA-001",
        revision: "A",
        date: { value: "2026-07-24", sourceCell: "Title Page!B6" },
      },
    },
    analyses: [
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "First tolerance loop",
        source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
      },
    ],
  };

  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookCatalog,
  };

  const result = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: {
      fileName: "anonymous-ta.xlsx",
      classification: "confidential",
      contentHash: "a".repeat(64),
      revision: "A",
      date: { value: "2026-07-24", sourceCell: "Title Page!B6" },
    },
    worksheets: [
      {
        selectionIndex: 1,
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "First tolerance loop",
        source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
      },
    ],
  };

  it("accepts confidential worksheet selection view request/result", () => {
    expect(worksheetSelectionViewRequestSchema.parse(request)).toEqual(request);
    expect(worksheetSelectionViewResultSchema.parse(result)).toEqual(result);
  });

  it.each([
    ["public input", { ...request, inputClassification: "public" }],
    ["extra request field", { ...request, unexpected: true }],
    ["zero selection index", { ...result, worksheets: [{ ...result.worksheets[0], selectionIndex: 0 }] }],
    ["extra result field", { ...result, workbook: { ...result.workbook, metadata: {} } }],
  ])("rejects worksheet selection view contract with %s", (_description, value) => {
    const schema = "workbookCatalog" in value ? worksheetSelectionViewRequestSchema : worksheetSelectionViewResultSchema;
    expect(schema.safeParse(value).success).toBe(false);
  });
});

describe("interpretation rules contracts", () => {
  const provenance = {
    classification: "internal" as const,
    sourceAlias: "capability-handbook",
    sourceFileHash: "a".repeat(64),
    sourceVersion: "2026-Q3",
    sheetName: "Rules",
    sourceRange: "A2:H20",
    owner: "knowledge-steward",
    confidence: 0.9,
    effectiveVersion: "interpretation-rules-v1" as const,
    changeSummary: "Initial reviewed interpretation rules.",
  };

  const commonEntry = {
    entryId: "entry-1",
    title: "Capability interpretation",
    description: "Interprets one-dimensional capability facts.",
    applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
    relatedEntryIds: [],
    provenance,
  };

  const entries = [
    {
      ...commonEntry,
      entryId: "metric-cpk",
      entryType: "metric-definition" as const,
      metric: "cpk",
      unit: "ratio",
    },
    {
      ...commonEntry,
      entryId: "performance-cpk",
      entryType: "performance-rule" as const,
      metric: "cpk",
      comparison: "greater-than-or-equal" as const,
      targetSource: "resolved-target" as const,
      requiredFacts: ["cpk", "targetCpk"],
      outcomeWhenMatched: "meets-target",
    },
    {
      ...commonEntry,
      entryId: "root-cause-contributor",
      entryType: "root-cause-signal" as const,
      signalStatus: "hypothesis" as const,
      requiredFacts: ["contributors"],
      validationFacts: ["contributor-evidence"],
      activationCondition: {
        kind: "maximum-contribution-at-least" as const,
        thresholdPercent: 30,
      },
    },
    {
      ...commonEntry,
      entryId: "improvement-review",
      entryType: "improvement-option" as const,
      expectedImpact: "Reduce the largest contributor.",
      tradeoffs: ["May increase manufacturing cost."],
      validationSteps: ["Recalculate the tolerance stack."],
    },
    {
      ...commonEntry,
      entryId: "decision-escalate",
      entryType: "decision-policy" as const,
      policyKind: "engineering-review" as const,
    },
  ];

  const source = {
    sourceAlias: "capability-handbook",
    sourceFileHash: "a".repeat(64),
    sourceVersion: "2026-Q3",
    classification: "internal" as const,
    owner: "knowledge-steward",
  };

  const manifest = {
    version: "interpretation-rules-v1" as const,
    classification: "internal" as const,
    sourceCount: 1,
    entryCount: 5,
    entryTypeCounts: {
      "metric-definition": 1,
      "performance-rule": 1,
      "root-cause-signal": 1,
      "improvement-option": 1,
      "decision-policy": 1,
    },
    sourcesHash: "b".repeat(64),
    entriesHash: "c".repeat(64),
    contentHash: "d".repeat(64),
  };

  const seedPackage = { manifest, sources: [source], entries };

  const evaluation = {
    knowledgeBaseVersion: "interpretation-rules-v1" as const,
    status: "matched" as const,
    resolvedTargets: {
      cpk: { value: 1.33, source: "project" as const },
      sigma: { value: 4.5, source: "template" as const },
    },
    factsUsed: ["cpk", "targetCpk"],
    matchedRules: [{
      entryId: "performance-cpk",
      entryType: "performance-rule" as const,
      relatedFactReferences: ["cpk", "targetCpk"],
      evidence: {
        sourceAlias: "capability-handbook",
        sheetName: "Rules",
        sourceRange: "A2:H20",
        sourceFileHash: "a".repeat(64),
      },
    }],
    missingFacts: [],
  };

  it("accepts the version, every entry discriminant, a strict seed package, and a version-only load request", () => {
    expect(interpretationRuleVersionSchema.parse("interpretation-rules-v1")).toBe("interpretation-rules-v1");
    expect(entries.map((entry) => interpretationEntryTypeSchema.parse(entry.entryType))).toEqual(
      entries.map((entry) => entry.entryType),
    );
    expect(entries.map((entry) => interpretationKnowledgeEntrySchema.parse(entry).entryType)).toEqual(
      entries.map((entry) => entry.entryType),
    );
    expect(interpretationKnowledgeSourceMetadataSchema.parse(source)).toEqual(source);
    expect(interpretationKnowledgeManifestSchema.parse(manifest)).toEqual(manifest);
    expect(interpretationKnowledgeSeedPackageSchema.parse(seedPackage)).toEqual(seedPackage);
    expect(interpretationRuleLoadRequestSchema.parse({ version: "interpretation-rules-v1" })).toEqual({
      version: "interpretation-rules-v1",
    });
    expect(interpretationRuleLoadRequestSchema.safeParse({
      version: "interpretation-rules-v1",
      seedPackage,
    }).success).toBe(false);
  });

  it.each([
    ["sourceCount", { ...manifest, sourceCount: 0 }, ["manifest", "sourceCount"]],
    ["entryCount", { ...manifest, entryCount: 4 }, ["manifest", "entryCount"]],
    [
      "entryTypeCounts",
      { ...manifest, entryTypeCounts: { ...manifest.entryTypeCounts, "performance-rule": 0 } },
      ["manifest", "entryTypeCounts", "performance-rule"],
    ],
  ])("rejects an inconsistent manifest %s at the manifest field", (_field, inconsistentManifest, expectedPath) => {
    const result = interpretationKnowledgeSeedPackageSchema.safeParse({
      ...seedPackage,
      manifest: inconsistentManifest,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        JSON.stringify(issue.path) === JSON.stringify(expectedPath))).toBe(true);
    }
  });

  it("accepts cpk, sigma, contributor facts, and preserves resolved target sources", () => {
    const request = {
      analysisDimension: "one-dimensional" as const,
      method: "worst-case" as const,
      facts: {
        cpk: 1.33,
        targetCpk: { value: 1.33, source: "project" as const },
        achievedSigma: 4,
        targetSigma: { value: 4.5, source: "template" as const },
        contributors: [{ reference: "dimension-A", contributionPercent: 62.5 }],
      },
    };
    expect(interpretationRuleEvaluationRequestSchema.parse(request)).toEqual(request);
    expect(interpretationRuleEvaluationSchema.parse(evaluation)).toEqual(evaluation);
    expect(interpretationRuleEvaluationSchema.parse({
      ...evaluation,
      resolvedTargets: { cpk: { value: 1.33, source: "project" } },
    }).resolvedTargets).toEqual({
      cpk: { value: 1.33, source: "project" },
    });
    expect(interpretationRuleEvaluationSchema.parse({
      ...evaluation,
      resolvedTargets: { sigma: { value: 4.5, source: "controlled-default" } },
    }).resolvedTargets).toEqual({
      sigma: { value: 4.5, source: "controlled-default" },
    });
    expect(interpretationRuleEvaluationRequestSchema.safeParse({
      ...request,
      facts: { ...request.facts, targetCpk: { value: 1.33, source: "controlled-default" } },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationRequestSchema.safeParse({
      ...request,
      facts: { ...request.facts, targetSigma: { value: 4.5, source: "controlled-default" } },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      resolvedTargets: { cpk: 1.33 },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      resolvedTargets: { sigma: 4.5 },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      resolvedTargets: { cpk: { value: 1.33, source: "project", unexpected: true } },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      resolvedTargets: { ...evaluation.resolvedTargets, unexpected: true },
    }).success).toBe(false);
  });

  it.each([
    ["matched", evaluation],
    ["insufficient-facts", {
      ...evaluation,
      status: "insufficient-facts",
      resolvedTargets: { cpk: evaluation.resolvedTargets.cpk },
      matchedRules: [],
      missingFacts: ["achievedSigma"],
    }],
    ["not-applicable", {
      ...evaluation,
      status: "not-applicable",
      resolvedTargets: {},
      matchedRules: [],
      missingFacts: [],
    }],
  ])("accepts a consistent %s evaluation", (_status, value) => {
    expect(interpretationRuleEvaluationSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["matched without a matched rule", { ...evaluation, matchedRules: [] }, ["matchedRules"]],
    ["matched with missing facts", { ...evaluation, missingFacts: ["cpk"] }, ["missingFacts"]],
    ["insufficient-facts with a matched rule", {
      ...evaluation, status: "insufficient-facts", missingFacts: ["cpk"],
    }, ["matchedRules"]],
    ["insufficient-facts without missing facts", {
      ...evaluation, status: "insufficient-facts", matchedRules: [],
    }, ["missingFacts"]],
    ["not-applicable with a matched rule", {
      ...evaluation, status: "not-applicable", resolvedTargets: {},
    }, ["matchedRules"]],
    ["not-applicable with missing facts", {
      ...evaluation, status: "not-applicable", resolvedTargets: {}, matchedRules: [], missingFacts: ["cpk"],
    }, ["missingFacts"]],
    ["not-applicable with a resolved target", {
      ...evaluation, status: "not-applicable", matchedRules: [],
    }, ["resolvedTargets"]],
    ["not-applicable without resolvedTargets", {
      knowledgeBaseVersion: evaluation.knowledgeBaseVersion,
      status: "not-applicable",
      factsUsed: evaluation.factsUsed,
      matchedRules: [],
      missingFacts: [],
    }, ["resolvedTargets"]],
  ])("rejects %s at the conflicting field", (_description, value, expectedPath) => {
    const result = interpretationRuleEvaluationSchema.safeParse(value);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        JSON.stringify(issue.path) === JSON.stringify(expectedPath))).toBe(true);
    }
  });

  it("rejects confidential provenance and non-hypothesis root-cause signals", () => {
    expect(interpretationProvenanceSchema.safeParse({ ...provenance, classification: "confidential" }).success).toBe(false);
    expect(interpretationKnowledgeEntrySchema.safeParse({ ...entries[2], signalStatus: "confirmed" }).success).toBe(false);
  });

  const rootCauseSignalWithoutActivationCondition = {
    entryId: entries[2].entryId,
    entryType: entries[2].entryType,
    title: entries[2].title,
    description: entries[2].description,
    applicability: entries[2].applicability,
    relatedEntryIds: entries[2].relatedEntryIds,
    provenance: entries[2].provenance,
    signalStatus: entries[2].signalStatus,
    requiredFacts: entries[2].requiredFacts,
    validationFacts: entries[2].validationFacts,
  };

  it.each([
    ["missing activation condition", rootCauseSignalWithoutActivationCondition],
    ["unknown activation kind", {
      ...entries[2], activationCondition: { kind: "average-contribution-at-least", thresholdPercent: 30 },
    }],
    ["negative threshold", {
      ...entries[2], activationCondition: { kind: "maximum-contribution-at-least", thresholdPercent: -0.01 },
    }],
    ["threshold above 100", {
      ...entries[2], activationCondition: { kind: "maximum-contribution-at-least", thresholdPercent: 100.01 },
    }],
    ["non-finite threshold", {
      ...entries[2], activationCondition: { kind: "maximum-contribution-at-least", thresholdPercent: Number.NaN },
    }],
    ["activation condition unknown field", {
      ...entries[2], activationCondition: {
        kind: "maximum-contribution-at-least", thresholdPercent: 30, unexpected: true,
      },
    }],
  ])("rejects a root-cause signal with %s", (_description, entry) => {
    expect(interpretationKnowledgeEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("does not permit an inline global Cpk target or ranked improvement advice", () => {
    expect(interpretationKnowledgeEntrySchema.safeParse({ ...entries[1], target: 1 }).success).toBe(false);
    expect(interpretationKnowledgeEntrySchema.safeParse({ ...entries[3], rank: 1 }).success).toBe(false);
    expect(interpretationKnowledgeEntrySchema.safeParse({ ...entries[3], recommendation: "Do this first." }).success).toBe(false);
  });

  it("accepts only the controlled performance outcomes", () => {
    expect(interpretationKnowledgeEntrySchema.safeParse({
      ...entries[1], outcomeWhenMatched: "unexpected-outcome",
    }).success).toBe(false);
    expect(interpretationKnowledgeEntrySchema.safeParse({
      ...entries[1], outcomeWhenMatched: "below-target",
    }).success).toBe(true);
  });

  it.each([
    ["entry unknown field", interpretationKnowledgeEntrySchema, { ...entries[0], unexpected: true }],
    ["nested applicability unknown field", interpretationKnowledgeEntrySchema, {
      ...entries[0], applicability: { ...entries[0].applicability, unexpected: true },
    }],
    ["source unknown field", interpretationKnowledgeSourceMetadataSchema, { ...source, unexpected: true }],
    ["manifest unknown field", interpretationKnowledgeManifestSchema, { ...manifest, unexpected: true }],
    ["seed package unknown field", interpretationKnowledgeSeedPackageSchema, { ...seedPackage, unexpected: true }],
    ["load request unknown field", interpretationRuleLoadRequestSchema, {
      version: "interpretation-rules-v1", unexpected: true,
    }],
    ["evaluation request unknown field", interpretationRuleEvaluationRequestSchema, {
      analysisDimension: "one-dimensional", method: "rss", facts: {}, unexpected: true,
    }],
    ["facts unknown field", interpretationRuleEvaluationRequestSchema, {
      analysisDimension: "one-dimensional", method: "rss", facts: { unexpected: true },
    }],
    ["evaluation unknown field", interpretationRuleEvaluationSchema, {
      knowledgeBaseVersion: "interpretation-rules-v1", status: "not-applicable",
      factsUsed: [], matchedRules: [], missingFacts: [], unexpected: true,
    }],
  ])("rejects %s", (_description, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["non-finite cpk", { cpk: Number.POSITIVE_INFINITY }],
    ["non-finite target Cpk", { targetCpk: { value: Number.NaN, source: "project" } }],
    ["non-finite sigma", { achievedSigma: Number.NEGATIVE_INFINITY }],
    ["negative contribution", { contributors: [{ reference: "A", contributionPercent: -0.1 }] }],
    ["contribution over 100", { contributors: [{ reference: "A", contributionPercent: 100.1 }] }],
  ])("rejects %s", (_description, facts) => {
    expect(interpretationRuleEvaluationRequestSchema.safeParse({
      analysisDimension: "one-dimensional",
      method: "rss",
      facts,
    }).success).toBe(false);
  });
});