import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  calculationCompletedResultSchema,
  interpretationResultSchema,
} from "@ai-assist/contracts";
import { createCalculation } from "./calculation.js";
import {
  createInterpretation,
  createInterpretationPlaceholder,
  createInterpretationService,
} from "./interpretation-placeholder.js";

const CONTENT_HASH = "a".repeat(64);

function availableText(rawText: string, sourceCell: string) {
  return { status: "available" as const, rawText, sourceCell };
}

function availableNumber(rawText: string, sourceCell: string, numericValue: number, unit = "mm") {
  return { status: "available" as const, rawText, sourceCell, numericValue, unit };
}

function factorRow(index: number) {
  const row = index + 2;
  const standardDeviation = index === 0 ? 2 : 1;
  return {
    sourceRow: row,
    fields: {
      factorName: availableText(`factor-${index + 1}`, `Analysis-A!A${row}`),
      nominalValue: availableNumber("0", `Analysis-A!B${row}`, 0),
      upperTolerance: availableNumber("1", `Analysis-A!C${row}`, 1),
      lowerTolerance: availableNumber("-1", `Analysis-A!D${row}`, -1),
      longTermSafetyFactor: availableNumber("1", `Analysis-A!E${row}`, 1),
      standardDeviation: availableNumber(String(standardDeviation), `Analysis-A!F${row}`, standardDeviation),
      distribution: availableText("normal", `Analysis-A!G${row}`),
      unit: availableText("mm", `Analysis-A!H${row}`),
    },
  };
}

function calculationRequest(factorCount = 4) {
  const rows = Array.from({ length: factorCount }, (_, index) => factorRow(index));
  return {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetAnalysisAssets: {
      contractVersion: "v1" as const,
      workbook: {
        classification: "confidential" as const,
        contentHash: CONTENT_HASH,
        catalogContractVersion: "v1" as const,
      },
      worksheets: [{
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "anonymous-analysis",
        factorTables: [{
          tableId: "table-a",
          headerRow: 1,
          dataRange: { startRow: 2, endRow: 1 + factorCount },
          columns: [
            { semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" },
            { semanticField: "nominalValue" as const, headerText: "Nominal", sourceColumn: "B" },
            { semanticField: "upperTolerance" as const, headerText: "Upper", sourceColumn: "C" },
            { semanticField: "lowerTolerance" as const, headerText: "Lower", sourceColumn: "D" },
            { semanticField: "longTermSafetyFactor" as const, headerText: "LTSF", sourceColumn: "E" },
            { semanticField: "standardDeviation" as const, headerText: "Sigma", sourceColumn: "F" },
            { semanticField: "distribution" as const, headerText: "Distribution", sourceColumn: "G" },
            { semanticField: "unit" as const, headerText: "Unit", sourceColumn: "H" },
          ],
          rows,
        }],
        formulaCells: [],
        imageAssets: [],
      }],
    },
    requiredFieldCheck: {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      workbookContentHash: CONTENT_HASH,
      status: "readyForNextCheck" as const,
      blockingIssues: [],
      advisoryIssues: [],
      summary: {
        worksheetsChecked: 1,
        factorTablesChecked: 1,
        factorRowsChecked: factorCount,
        blockingIssueCount: 0,
        advisoryIssueCount: 0,
      },
    },
    exceptionResolution: {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      workbookContentHash: CONTENT_HASH,
      knowledgeBaseVersion: "v1" as const,
      status: "readyToContinue" as const,
      readyToContinue: true as const,
      acceptedExceptions: [],
      pendingExceptions: [],
      summary: {
        actionableSignalCount: 0,
        acceptedExceptionCount: 0,
        pendingExceptionCount: 0,
        invalidCandidateCount: 0,
      },
    },
    worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-a" },
    systemSpecification: {
      designNominal: 0,
      lowerSpecLimit: -3,
      upperSpecLimit: 3,
      targetSigmaLevel: 3,
      targetCpk: 1.33,
      additionalMeanShift: -1,
    },
    criticality: "none" as const,
    scenarioOverrides: [],
  };
}

function completedCalculation(factorCount = 4) {
  const result = createCalculation(calculationRequest(factorCount));
  expect(result.status).toBe("completed");
  if (result.status !== "completed") throw new Error("expected completed calculation fixture");
  return result;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

function captureThrown(action: () => unknown): unknown {
  try {
    action();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("createInterpretation", () => {
  it("interprets a four-factor below-target RSS result with traceable F0 statements", () => {
    const calculationResult = completedCalculation();
    expect(calculationResult.recommendation.method).toBe("rss_1d");
    expect(calculationResult.capability.cpk).toBeLessThan(calculationResult.capability.targetCpk);

    const result = createInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult,
    });

    expect(result).toMatchObject({
      featureId: "F5.1",
      status: "completed",
      knowledgeBaseVersion: "interpretation-rules-v1",
      ruleEvaluationStatus: "matched",
    });
    if (result.status !== "completed") throw new Error("expected completed interpretation");

    const facts = result.statements.filter((statement) => statement.type === "FACT");
    expect(facts.map(({ content }) => content.metric)).toEqual(expect.arrayContaining([
      "cpk",
      "cp",
      "rss_sigma",
      "total_dpm",
      "yield",
      "lower_spec_limit",
      "upper_spec_limit",
      "recommended_method",
      "achieved_sigma",
      "target_cpk",
      "target_sigma",
      "factor_contribution",
    ]));
    expect(facts.filter(({ content }) => content.metric === "factor_contribution")).toHaveLength(4);
    const expectedFactSections = {
      cpk: "capability-vs-specification",
      cp: "calculation-summary",
      rss_sigma: "calculation-summary",
      total_dpm: "calculation-summary",
      yield: "calculation-summary",
      lower_spec_limit: "capability-vs-specification",
      upper_spec_limit: "capability-vs-specification",
      recommended_method: "calculation-summary",
      achieved_sigma: "calculation-summary",
      target_cpk: "capability-vs-specification",
      target_sigma: "calculation-summary",
      factor_contribution: "major-contributors",
    } as const;
    for (const fact of facts) {
      expect(fact.section).toBe(expectedFactSections[fact.content.metric]);
    }
    expect(result.statements).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "RULE", content: expect.objectContaining({ entryId: "performance-cpk-below-target" }) }),
      expect.objectContaining({ type: "SIGNAL", content: expect.objectContaining({ entryId: "root-cause-contributor-concentration", requiresEngineeringReview: true }) }),
      expect.objectContaining({ type: "OPTION", content: expect.objectContaining({ rank: null }) }),
    ]));
    for (const statement of result.statements.filter(({ type }) => type !== "FACT")) {
      expect(statement.content.evidence).toEqual(expect.objectContaining({
        classification: "internal",
        sourceAlias: expect.any(String),
        sourceVersion: expect.any(String),
        sheetName: expect.any(String),
        sourceRange: expect.any(String),
        sourceFileHash: expect.any(String),
        owner: expect.any(String),
        confidence: expect.any(Number),
        effectiveVersion: "interpretation-rules-v1",
        changeSummary: expect.any(String),
      }));
    }
    expect(new Set(result.statements.map(({ statementId }) => statementId)).size).toBe(result.statements.length);
    expect(result.clarifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: "drawing_evidence_not_evaluated",
        scopes: [
          "tolerance_loop_closure",
          "datum_chain",
          "assembly_datum_face",
          "stack_start",
          "direction",
          "cross_subsystem",
        ],
      }),
    ]));
    expect(interpretationResultSchema.parse(result)).toEqual(result);
    expectDeeplyFrozen(result);
  });

  it("does not emit root-cause signals or options when RSS performance meets its targets", () => {
    const request = calculationRequest();
    request.systemSpecification.targetCpk = 0.1;
    request.systemSpecification.targetSigmaLevel = 1;
    const calculationResult = createCalculation(request);
    expect(calculationResult.status).toBe("completed");
    if (calculationResult.status !== "completed") return;

    const result = createInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult,
    });
    if (result.status !== "completed") throw new Error("expected completed interpretation");

    expect(result.ruleEvaluationStatus).toBe("matched");
    expect(result.statements.some(({ type }) => type === "RULE")).toBe(true);
    expect(result.statements.some(({ type }) => type === "SIGNAL" || type === "OPTION")).toBe(false);
  });

  it("maps insufficient rule facts to a clarification without derived statements", () => {
    const interpret = createInterpretationService({
      loadRules: () => ({
        evaluateInterpretationRules: () => ({
          knowledgeBaseVersion: "interpretation-rules-v1" as const,
          status: "insufficient-facts" as const,
          resolvedTargets: {},
          factsUsed: ["cpk" as const],
          matchedRules: [],
          missingFacts: ["targetCpk" as const, "targetSigma" as const],
        }),
      }),
    });

    const result = interpret({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult: completedCalculation(),
    });
    if (result.status !== "completed") throw new Error("expected completed interpretation");

    expect(result.ruleEvaluationStatus).toBe("insufficient-facts");
    expect(result.statements.every(({ type }) => type === "FACT")).toBe(true);
    expect(result.clarifications).toEqual(expect.arrayContaining([expect.objectContaining({
      reasonCode: "rule_facts_insufficient",
      missingFacts: ["targetCpk", "targetSigma"],
    })]));
    expect(interpretationResultSchema.parse(result)).toEqual(result);
  });

  it("copies controlled matched-rule metadata into F5.1 statements without deriving it", () => {
    const applicability = { analysisDimension: "one-dimensional" as const };
    const interpret = createInterpretationService({
      loadRules: () => ({
        evaluateInterpretationRules: () => ({
          knowledgeBaseVersion: "interpretation-rules-v1" as const,
          status: "matched" as const,
          resolvedTargets: { cpk: { value: 1.33, source: "project" as const } },
          factsUsed: ["cpk" as const, "targetCpk" as const],
          matchedRules: [{
            entryId: "controlled-performance-rule",
            entryType: "performance-rule" as const,
            effectiveVersion: "interpretation-rules-v1" as const,
            applicability,
            relatedFactReferences: ["cpk" as const, "targetCpk" as const],
            evidence: {
              classification: "internal" as const,
              sourceAlias: "controlled-source",
              sourceVersion: "2026-Q3",
              sheetName: "Rules",
              sourceRange: "A2:B2",
              sourceFileHash: "b".repeat(64),
              owner: "controlled-owner",
              confidence: 0.9,
              effectiveVersion: "interpretation-rules-v1" as const,
              changeSummary: "Controlled reviewed provenance.",
            },
          }],
          missingFacts: [],
        }),
      }),
    });

    const result = interpret({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult: completedCalculation(),
    });
    if (result.status !== "completed") throw new Error("expected completed interpretation");
    const rule = result.statements.find(({ type }) => type === "RULE");

    expect(rule?.content).toMatchObject({
      effectiveVersion: "interpretation-rules-v1",
      applicability,
      evidence: {
        classification: "internal",
        sourceAlias: "controlled-source",
        sourceVersion: "2026-Q3",
        sheetName: "Rules",
        sourceRange: "A2:B2",
        sourceFileHash: "b".repeat(64),
        owner: "controlled-owner",
        confidence: 0.9,
        effectiveVersion: "interpretation-rules-v1",
        changeSummary: "Controlled reviewed provenance.",
      },
    });
    expect(rule?.content.applicability).not.toBe(applicability);
  });

  it("keeps WC facts without applying RSS rules", () => {
    const calculationResult = completedCalculation(3);
    expect(calculationResult.recommendation.method).toBe("worst_case");

    const result = createInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult,
    });
    if (result.status !== "completed") throw new Error("expected completed interpretation");

    expect(result.ruleEvaluationStatus).toBe("not-applicable");
    expect(result.statements.length).toBeGreaterThan(0);
    expect(result.statements.every(({ type }) => type === "FACT")).toBe(true);
    expect(result.clarifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: "rule_method_not_applicable" }),
    ]));
  });

  it("requires 3D follow-up without applying RSS rules", () => {
    const calculationResult = completedCalculation(11);
    expect(calculationResult.recommendation.method).toBe("refer_3d_variation_analysis");

    const result = createInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult,
    });
    if (result.status !== "completed") throw new Error("expected completed interpretation");

    expect(result.ruleEvaluationStatus).toBe("not-applicable");
    expect(result.statements.every(({ type }) => type === "FACT")).toBe(true);
    expect(result.clarifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: "rule_method_not_applicable" }),
      expect.objectContaining({ reasonCode: "three_dimensional_follow_up_required" }),
    ]));
  });

  it("denies public input before validating nested calculation data", () => {
    const error = captureThrown(() => createInterpretation({
      contractVersion: "v1",
      inputClassification: "public",
      calculationResult: "malformed",
    }));

    expect(error).toMatchObject({ code: "policy_denied" });
  });

  it("requires exactly one trace for every F5 formula output", () => {
    const calculationResult = completedCalculation();
    const requiredOutputFields = [
      "capability.cpk",
      "capability.cp",
      "system.rssSigma",
      "capability.totalDpm",
      "capability.yield",
      "capability.lowerZ",
      "capability.upperZ",
      ...calculationResult.factors.map((_, index) => `factors[${index}].contribution`),
    ];

    for (const outputField of requiredOutputFields) {
      const incompleteCalculation = {
        ...calculationResult,
        traceRecords: calculationResult.traceRecords.filter((record) => record.outputField !== outputField),
      };
      expect(calculationCompletedResultSchema.safeParse(incompleteCalculation).success).toBe(true);

      const error = captureThrown(() => createInterpretation({
        contractVersion: "v1",
        inputClassification: "confidential",
        calculationResult: incompleteCalculation,
      }));

      expect(error).toMatchObject({
        code: "prerequisite_not_ready",
        affectedInputReferences: ["interpretation-request-v1"],
      });
      expect(error).not.toBeInstanceOf(TypeError);
    }
  });

  it("rejects a required trace whose formulaId does not match its outputField", () => {
    const calculationResult = completedCalculation();
    const forgedCalculation = structuredClone(calculationResult);
    const cpkTrace = forgedCalculation.traceRecords.find(
      ({ outputField }) => outputField === "capability.cpk",
    );
    if (cpkTrace === undefined) throw new Error("expected capability.cpk trace fixture");
    cpkTrace.formulaId = "yield-v1";
    expect(calculationCompletedResultSchema.safeParse(forgedCalculation).success).toBe(true);

    const error = captureThrown(() => createInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult: forgedCalculation,
    }));

    expect(error).toMatchObject({
      code: "prerequisite_not_ready",
      affectedInputReferences: ["interpretation-request-v1"],
    });
  });

  it("rejects duplicate required traces without leaking trace markers", () => {
    const calculationResult = completedCalculation();
    const marker = "sensitive-duplicate-trace-marker";
    const cpkTrace = calculationResult.traceRecords.find(({ outputField }) => outputField === "capability.cpk");
    if (cpkTrace === undefined) throw new Error("expected capability.cpk trace fixture");
    const ambiguousCalculation = {
      ...calculationResult,
      traceRecords: [
        ...calculationResult.traceRecords,
        { ...cpkTrace, sourceCells: [marker] },
      ],
    };
    expect(calculationCompletedResultSchema.safeParse(ambiguousCalculation).success).toBe(true);

    const error = captureThrown(() => createInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult: ambiguousCalculation,
    }));

    expect(error).toMatchObject({
      code: "prerequisite_not_ready",
      affectedInputReferences: ["interpretation-request-v1"],
    });
    expect(JSON.stringify(error)).not.toContain(marker);
  });

  it("converts an inputClassification getter failure to a safe typed validation error", () => {
    const marker = "sensitive-getter-marker";
    const request = Object.defineProperty({}, "inputClassification", {
      get() {
        throw new Error(marker);
      },
    });

    const error = captureThrown(() => createInterpretation(request));

    expect(error).toMatchObject({
      code: "validation_error",
      affectedInputReferences: ["interpretation-request-v1"],
    });
    expect(JSON.stringify(error)).not.toContain(marker);
  });

  it("converts a calculationResult getter failure to a safe typed validation error", () => {
    const marker = "sensitive-calculation-getter-marker";
    const request = Object.defineProperty({
      contractVersion: "v1",
      inputClassification: "confidential",
    }, "calculationResult", {
      enumerable: true,
      get() {
        throw new Error(marker);
      },
    });

    const error = captureThrown(() => createInterpretation(request));

    expect(error).toMatchObject({
      code: "validation_error",
      affectedInputReferences: ["interpretation-request-v1"],
    });
    expect(JSON.stringify(error)).not.toContain(marker);
  });

  it("does not leak invalid input markers through typed validation errors", () => {
    const marker = "sensitive-interpretation-marker";
    const error = captureThrown(() => createInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult: { marker },
    }));

    expect(error).toMatchObject({
      code: "validation_error",
      affectedInputReferences: ["interpretation-request-v1"],
    });
    expect(JSON.stringify(error)).not.toContain(marker);
  });

  it("retains the placeholder name as a deterministic compatibility alias", () => {
    const request = {
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult: completedCalculation(),
    } as const;

    const current = createInterpretation(request);
    const compatible = createInterpretationPlaceholder(request);
    expect(compatible).toEqual(current);
    expect(compatible).not.toBe(current);
  });

  it("exports both interpretation names through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        "import { createInterpretation, createInterpretationPlaceholder } from '@ai-assist/workbook-catalog'; console.log(typeof createInterpretation, typeof createInterpretationPlaceholder);",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function function");
  });
});