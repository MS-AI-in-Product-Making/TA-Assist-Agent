import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  capabilityEntrySchema,
  capabilityValidationRequestSchema,
  capabilityValidationResultSchema,
  capabilityTierSchema,
  createTypedError,
  engineeringRuleEntrySchema,
  engineeringRuleQuerySchema,
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
  skillResultSchema,
  terminologyEntrySchema,
  typedErrorSchema,
  worksheetAnalysisAssetsRequestSchema,
  worksheetAnalysisAssetsResultSchema,
  worksheetImageReadRequestSchema,
  worksheetImageReadResultSchema,
} from "./index.js";

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
});