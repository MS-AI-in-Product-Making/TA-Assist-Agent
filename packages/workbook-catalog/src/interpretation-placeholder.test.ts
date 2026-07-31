import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { interpretationResultSchema } from "@ai-assist/contracts";
import { createCalculation } from "./calculation.js";
import { createInterpretation, createInterpretationPlaceholder } from "./interpretation-placeholder.js";

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
    expect(result.statements).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "RULE", content: expect.objectContaining({ entryId: "performance-cpk-below-target" }) }),
      expect.objectContaining({ type: "SIGNAL", content: expect.objectContaining({ entryId: "root-cause-contributor-concentration", requiresEngineeringReview: true }) }),
      expect.objectContaining({ type: "OPTION", content: expect.objectContaining({ rank: null }) }),
    ]));
    for (const statement of result.statements.filter(({ type }) => type !== "FACT")) {
      expect(statement.content.evidence).toEqual({
        sourceAlias: expect.any(String),
        sheetName: expect.any(String),
        sourceRange: expect.any(String),
        sourceFileHash: expect.any(String),
      });
    }
    expect(new Set(result.statements.map(({ statementId }) => statementId)).size).toBe(result.statements.length);
    expect(result.clarifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: "drawing_evidence_not_evaluated" }),
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