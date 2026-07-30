import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createCalculation } from "./calculation.js";

const CONTENT_HASH = "a".repeat(64);

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function availableText(rawText: string, sourceCell: string) {
  return {
    status: "available" as const,
    rawText,
    sourceCell,
  };
}

function availableNumber(rawText: string, sourceCell: string, numericValue: number, unit = "mm") {
  return {
    status: "available" as const,
    rawText,
    sourceCell,
    numericValue,
    unit,
  };
}

function factorFields(index: number) {
  const row = index + 2;
  return {
    factorName: availableText(`factor-${index + 1}`, `Analysis-A!A${row}`),
    nominalValue: availableNumber("0", `Analysis-A!B${row}`, 0),
    upperTolerance: availableNumber("1", `Analysis-A!C${row}`, 1),
    lowerTolerance: availableNumber("-1", `Analysis-A!D${row}`, -1),
    longTermSafetyFactor: availableNumber("1", `Analysis-A!E${row}`, 1),
    standardDeviation: availableNumber("1", `Analysis-A!F${row}`, 1),
    distribution: availableText(" normal ", `Analysis-A!G${row}`),
    unit: availableText("mm", `Analysis-A!H${row}`),
  };
}

function factorRow(index: number) {
  return {
    sourceRow: index + 2,
    fields: factorFields(index),
  };
}

function baseRequest(factorCount = 1) {
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
    worksheetSelection: {
      worksheetName: "Analysis-A",
      tableId: "table-a",
    },
    systemSpecification: {
      designNominal: 0,
      lowerSpecLimit: -3,
      upperSpecLimit: 3,
      targetSigmaLevel: 3,
      targetCpk: 1,
      additionalMeanShift: -1,
    },
    criticality: "none" as const,
    scenarioOverrides: [],
  };
}

function expectValidationError(action: () => unknown): void {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toMatchObject({
    code: "validation_error",
    affectedInputReferences: ["calculation-request-v1"],
  });
}

describe("createCalculation", () => {
  it("returns a deeply frozen completed result for selected worksheet/table and maps standardDeviation to sigmaLevel", () => {
    const result = createCalculation(baseRequest(1));

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;

    expect(result.worksheetSelection).toEqual({ worksheetName: "Analysis-A", tableId: "table-a" });
    expect(result.factorCount).toBe(1);
    expect(result.recommendation).toEqual({
      method: "worst_case",
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    });
    expect(result.factors[0]).toMatchObject({
      factorName: "factor-1",
      unit: "mm",
      source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
      input: {
        nominalValue: 0,
        upperTolerance: 1,
        lowerTolerance: -1,
        longTermSafetyFactor: 1,
        sigmaLevel: 1,
        distribution: "normal",
      },
    });
    expect(result.system.additionalMeanShift).toBe(-1);
    expect(result.traceRecords.length).toBeGreaterThan(0);
    expect(result.traceRecords.some((record) => record.outputField === "factors[0].sigma" && record.formulaId === "factor-sigma-v1")).toBe(true);
    expect(result.traceRecords.some((record) => record.outputField === "capability.cpk" && record.formulaId === "cpk-v1")).toBe(true);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.factors)).toBe(true);
    expect(Object.isFrozen(result.factors[0]!)).toBe(true);
    expect(Object.isFrozen(result.traceRecords)).toBe(true);
    expect(() => {
      (result.factors as Array<{ factorName: string }>).push({ factorName: "changed" } as { factorName: string });
    }).toThrow();
  });

  it("returns referral recommendation for 11 factors while still computing WC/RSS", () => {
    const result = createCalculation(baseRequest(11));

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;

    expect(result.factorCount).toBe(11);
    expect(result.recommendation.method).toBe("refer_3d_variation_analysis");
    expect(result.recommendation.refer3d).toBe(true);
    expect(Number.isFinite(result.system.worstCaseUpper)).toBe(true);
    expect(Number.isFinite(result.system.worstCaseLower)).toBe(true);
    expect(Number.isFinite(result.system.rssSigma)).toBe(true);
  });

  it("sets criticalityRisk for CTS/CTF without changing recommendation boundary", () => {
    const ctsResult = createCalculation({ ...baseRequest(1), criticality: "CTS" as const });
    const ctfResult = createCalculation({ ...baseRequest(1), criticality: "CTF" as const });

    expect(ctsResult.status).toBe("completed");
    expect(ctfResult.status).toBe("completed");
    if (ctsResult.status !== "completed" || ctfResult.status !== "completed") return;

    expect(ctsResult.recommendation).toMatchObject({ method: "worst_case", criticality: "CTS", criticalityRisk: true });
    expect(ctfResult.recommendation).toMatchObject({ method: "worst_case", criticality: "CTF", criticalityRisk: true });
  });

  it("denies public classification before schema parsing nested payload", () => {
    let error: unknown;

    try {
      createCalculation({
        ...baseRequest(1),
        inputClassification: "public",
        worksheetAnalysisAssets: "not-a-valid-object",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "policy_denied", affectedInputReferences: ["calculation-request-v1"] });
  });

  it("returns fixed validation errors for malformed payload, hash mismatch, blocked/pending prerequisites and missing selection", () => {
    expectValidationError(() => createCalculation({ ...baseRequest(1), worksheetSelection: { worksheetName: "Analysis-A", tableId: "missing-table" } }));
    expectValidationError(() => createCalculation({ ...baseRequest(1), requiredFieldCheck: { ...baseRequest(1).requiredFieldCheck, workbookContentHash: "b".repeat(64) } }));
    expectValidationError(() => createCalculation({ ...baseRequest(1), requiredFieldCheck: { ...baseRequest(1).requiredFieldCheck, status: "blocked", blockingIssues: [{ issueCode: "factor_table_has_no_rows", worksheetName: "Analysis-A", tableId: "table-a" }], summary: { ...baseRequest(1).requiredFieldCheck.summary, blockingIssueCount: 1 } } }));
    expectValidationError(() => createCalculation({ ...baseRequest(1), exceptionResolution: { ...baseRequest(1).exceptionResolution, status: "pendingExceptions", readyToContinue: false, pendingExceptions: [{ signalRef: "sig-1", reasonCode: "missing_candidate", snapshot: { signalKind: "tolerance_out_of_library", worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, factorName: "factor-1", signal: { status: "out_of_library", totalTolerance: 1, unit: "mm" } } }], summary: { actionableSignalCount: 1, acceptedExceptionCount: 0, pendingExceptionCount: 1, invalidCandidateCount: 0 } } }));
    expectValidationError(() => createCalculation({ broken: true }));
  });

  it("rejects non-empty scenarios with validation_error until Task4", () => {
    const request = baseRequest(1);
    expectValidationError(() => createCalculation({
      ...request,
      scenarioOverrides: [{
        scenarioId: "scenario-1",
        factorOverrides: [{
          worksheetName: "Analysis-A",
          tableId: "table-a",
          sourceRow: 2,
          nominalValue: 1,
        }],
      }],
    }));
  });

  it("rejects unavailable, non-finite, unknown distribution, missing unit and unit mismatch rows", () => {
    const request = baseRequest(1);

    expectValidationError(() => createCalculation({
      ...request,
      worksheetAnalysisAssets: {
        ...request.worksheetAnalysisAssets,
        worksheets: [{
          ...request.worksheetAnalysisAssets.worksheets[0],
          factorTables: [{
            ...request.worksheetAnalysisAssets.worksheets[0]!.factorTables[0],
            rows: [{
              sourceRow: 2,
              fields: {
                ...factorFields(0),
                nominalValue: { status: "unavailable", reasonCode: "missing" },
              },
            }],
          }],
        }],
      },
    }));

    expectValidationError(() => createCalculation({
      ...request,
      worksheetAnalysisAssets: {
        ...request.worksheetAnalysisAssets,
        worksheets: [{
          ...request.worksheetAnalysisAssets.worksheets[0],
          factorTables: [{
            ...request.worksheetAnalysisAssets.worksheets[0]!.factorTables[0],
            rows: [{
              sourceRow: 2,
              fields: {
                ...factorFields(0),
                standardDeviation: availableNumber("NaN", "Analysis-A!F2", Number.NaN),
              },
            }],
          }],
        }],
      },
    }));

    expectValidationError(() => createCalculation({
      ...request,
      worksheetAnalysisAssets: {
        ...request.worksheetAnalysisAssets,
        worksheets: [{
          ...request.worksheetAnalysisAssets.worksheets[0],
          factorTables: [{
            ...request.worksheetAnalysisAssets.worksheets[0]!.factorTables[0],
            rows: [{
              sourceRow: 2,
              fields: {
                ...factorFields(0),
                distribution: availableText("mystery", "Analysis-A!G2"),
              },
            }],
          }],
        }],
      },
    }));

    expectValidationError(() => createCalculation({
      ...request,
      worksheetAnalysisAssets: {
        ...request.worksheetAnalysisAssets,
        worksheets: [{
          ...request.worksheetAnalysisAssets.worksheets[0],
          factorTables: [{
            ...request.worksheetAnalysisAssets.worksheets[0]!.factorTables[0],
            rows: [{
              sourceRow: 2,
              fields: {
                ...factorFields(0),
                unit: availableText("", "Analysis-A!H2"),
                nominalValue: { ...availableNumber("0", "Analysis-A!B2", 0), unit: undefined },
                upperTolerance: { ...availableNumber("1", "Analysis-A!C2", 1), unit: undefined },
                lowerTolerance: { ...availableNumber("-1", "Analysis-A!D2", -1), unit: undefined },
                longTermSafetyFactor: { ...availableNumber("1", "Analysis-A!E2", 1), unit: undefined },
                standardDeviation: { ...availableNumber("1", "Analysis-A!F2", 1), unit: undefined },
              },
            }],
          }],
        }],
      },
    }));

    expectValidationError(() => createCalculation({
      ...request,
      worksheetAnalysisAssets: {
        ...request.worksheetAnalysisAssets,
        worksheets: [{
          ...request.worksheetAnalysisAssets.worksheets[0],
          factorTables: [{
            ...request.worksheetAnalysisAssets.worksheets[0]!.factorTables[0],
            rows: [{
              sourceRow: 2,
              fields: {
                ...factorFields(0),
                nominalValue: availableNumber("0", "Analysis-A!B2", 0, "mm"),
                upperTolerance: availableNumber("1", "Analysis-A!C2", 1, "inch"),
              },
            }],
          }],
        }],
      },
    }));
  });

  it("maps kernel zero RSS failure to fixed validation_error without leaking sensitive text", () => {
    const marker = "sensitive-factor-name-raw-marker";
    const request = baseRequest(1);
    const mutated = deepClone(request);
    mutated.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!.rows[0]!.fields.factorName = availableText(marker, "Analysis-A!A2");
    mutated.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!.rows[0]!.fields.upperTolerance = availableNumber("0", "Analysis-A!C2", 0);
    mutated.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!.rows[0]!.fields.lowerTolerance = availableNumber("0", "Analysis-A!D2", 0);

    let error: unknown;
    try {
      createCalculation(mutated);
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Calculation cannot be completed.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    const typed = error as Error & { summary?: string; message?: string; suggestedAction?: string; affectedInputReferences?: string[] };
    expect(typed.summary ?? "").not.toContain(marker);
    expect(typed.message ?? "").not.toContain(marker);
    expect(typed.suggestedAction ?? "").not.toContain(marker);
    expect((typed.affectedInputReferences ?? []).join(" ")).not.toContain(marker);
  });

  it("does not expose workbook bytes or exception rationale in completed output", () => {
    const request = baseRequest(1);
    const result = createCalculation(request);

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("workbookBytes");
    expect(serialized).not.toContain("rawText");
    expect(serialized).not.toContain("rationale");
  });

  it("exports createCalculation through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createCalculation } from '@ai-assist/workbook-catalog'; console.log(typeof createCalculation);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});
