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
  expectTypedErrorCode(action, "validation_error");
}

function expectTypedErrorCode(
  action: () => unknown,
  code: "validation_error" | "policy_denied" | "evidence_mismatch" | "prerequisite_not_ready" | "calculation_not_possible",
): void {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toMatchObject({
    code,
    affectedInputReferences: ["calculation-request-v1"],
  });
}

function captureThrown(action: () => unknown): unknown {
  try {
    action();
    return undefined;
  } catch (error) {
    return error;
  }
}

function expectNoMarkerLeak(error: unknown, marker: string): void {
  const candidate = error as {
    readonly summary?: unknown;
    readonly message?: unknown;
    readonly suggestedAction?: unknown;
    readonly details?: unknown;
  };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const summary = typeof candidate.summary === "string" ? candidate.summary : "";
  const suggestedAction = typeof candidate.suggestedAction === "string" ? candidate.suggestedAction : "";
  const serializedError = JSON.stringify(error);
  const serializedDetails = JSON.stringify(candidate.details);
  const leakSurface = [message, summary, suggestedAction, serializedError, serializedDetails].join(" ");
  expect(leakSurface).not.toContain(marker);
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
    expectTypedErrorCode(() => createCalculation({
      ...baseRequest(1),
      inputClassification: "public",
      worksheetAnalysisAssets: "not-a-valid-object",
    }), "policy_denied");
  });

  it("prioritizes policy_denied for non-confidential classification even when other getters throw", () => {
    const marker = "policy-should-short-circuit-before-marker";
    const request = {
      inputClassification: "public",
      get worksheetAnalysisAssets() {
        throw new Error(marker);
      },
    };

    const error = captureThrown(() => createCalculation(request));

    expect(error).toMatchObject({
      code: "policy_denied",
      summary: "Calculation input is not permitted.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    expectNoMarkerLeak(error, marker);
  });

  it("maps root proxy inputClassification getter throw to fixed validation_error without leaking marker", () => {
    const marker = "root-input-classification-throws-sensitive";
    const request = new Proxy({}, {
      get(_target, property) {
        if (property === "inputClassification") {
          throw new Error(marker);
        }
        return undefined;
      },
    });

    const error = captureThrown(() => createCalculation(request));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Calculation request is invalid.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    expectNoMarkerLeak(error, marker);
  });

  it("maps worksheetAnalysisAssets getter throw during parsing to fixed validation_error without leaking marker", () => {
    const marker = "worksheet-assets-getter-sensitive";
    const request = {
      inputClassification: "confidential",
      get worksheetAnalysisAssets() {
        throw new Error(marker);
      },
    };

    const error = captureThrown(() => createCalculation(request));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Calculation request is invalid.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    expectNoMarkerLeak(error, marker);
  });

  it("rejects forged root getter object with valid code but missing typed fields", () => {
    const marker = "SENSITIVE-root-forged-marker";
    const forged = { code: "policy_denied", marker };
    const request = {
      get inputClassification() {
        throw forged;
      },
    };

    const error = captureThrown(() => createCalculation(request));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Calculation request is invalid.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    expect(error).not.toBe(forged);
    expectNoMarkerLeak(error, marker);
  });

  it("maps nested proxy getter throw during safeParse to fixed validation_error without leaking marker", () => {
    const marker = "nested-safe-parse-sensitive";
    const request = deepClone(baseRequest(1));
    request.worksheetAnalysisAssets = new Proxy(request.worksheetAnalysisAssets, {
      get(target, property, receiver) {
        if (property === "workbook") {
          const workbook = Reflect.get(target, property, receiver) as Record<string, unknown>;
          return new Proxy(workbook, {
            get(workbookTarget, workbookProperty, workbookReceiver) {
              if (workbookProperty === "contentHash") {
                throw new Error(marker);
              }
              return Reflect.get(workbookTarget, workbookProperty, workbookReceiver);
            },
          });
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const error = captureThrown(() => createCalculation(request));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Calculation request is invalid.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    expectNoMarkerLeak(error, marker);
  });

  it("rejects forged nested getter object with valid code but missing typed fields", () => {
    const marker = "SENSITIVE-nested-forged-marker";
    const forged = { code: "policy_denied", marker };
    const request = deepClone(baseRequest(1));
    request.worksheetAnalysisAssets = new Proxy(request.worksheetAnalysisAssets, {
      get(target, property, receiver) {
        if (property === "workbook") {
          const workbook = Reflect.get(target, property, receiver) as Record<string, unknown>;
          return new Proxy(workbook, {
            get(workbookTarget, workbookProperty, workbookReceiver) {
              if (workbookProperty === "contentHash") {
                throw forged;
              }
              return Reflect.get(workbookTarget, workbookProperty, workbookReceiver);
            },
          });
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const error = captureThrown(() => createCalculation(request));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Calculation request is invalid.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    expect(error).not.toBe(forged);
    expectNoMarkerLeak(error, marker);
  });

  it("classifies malformed payload and selection misses as validation_error", () => {
    expectValidationError(() => createCalculation({ ...baseRequest(1), worksheetSelection: { worksheetName: "Analysis-A", tableId: "missing-table" } }));
    expectValidationError(() => createCalculation({
      ...baseRequest(1),
      requiredFieldCheck: "not-a-schema-valid-result",
      exceptionResolution: { ...baseRequest(1).exceptionResolution, workbookContentHash: "b".repeat(64) },
    }));
    expectValidationError(() => createCalculation({ broken: true }));
  });

  it("classifies constituent hash mismatch as evidence_mismatch", () => {
    expectTypedErrorCode(() => createCalculation({
      ...baseRequest(1),
      requiredFieldCheck: { ...baseRequest(1).requiredFieldCheck, workbookContentHash: "b".repeat(64) },
    }), "evidence_mismatch");

    expectTypedErrorCode(() => createCalculation({
      ...baseRequest(1),
      exceptionResolution: { ...baseRequest(1).exceptionResolution, workbookContentHash: "c".repeat(64) },
    }), "evidence_mismatch");
  });

  it("classifies ready-state blockers as prerequisite_not_ready", () => {
    expectTypedErrorCode(() => createCalculation({
      ...baseRequest(1),
      requiredFieldCheck: {
        ...baseRequest(1).requiredFieldCheck,
        status: "blocked",
        blockingIssues: [{ issueCode: "factor_table_has_no_rows", worksheetName: "Analysis-A", tableId: "table-a" }],
        summary: { ...baseRequest(1).requiredFieldCheck.summary, blockingIssueCount: 1 },
      },
    }), "prerequisite_not_ready");

    expectTypedErrorCode(() => createCalculation({
      ...baseRequest(1),
      exceptionResolution: {
        ...baseRequest(1).exceptionResolution,
        status: "pendingExceptions",
        readyToContinue: false,
        pendingExceptions: [{
          signalRef: "sig-1",
          reasonCode: "missing_candidate",
          snapshot: {
            signalKind: "tolerance_out_of_library",
            worksheetName: "Analysis-A",
            tableId: "table-a",
            sourceRow: 2,
            factorName: "factor-1",
            signal: { status: "out_of_library", totalTolerance: 1, unit: "mm" },
          },
        }],
        summary: {
          actionableSignalCount: 1,
          acceptedExceptionCount: 0,
          pendingExceptionCount: 1,
          invalidCandidateCount: 0,
        },
      },
    }), "prerequisite_not_ready");
  });

  it("applies classification priority: policy > malformed constituent > evidence mismatch > prerequisite > generic validation", () => {
    const blockedRequest = {
      ...baseRequest(1),
      requiredFieldCheck: {
        ...baseRequest(1).requiredFieldCheck,
        status: "blocked" as const,
        blockingIssues: [{ issueCode: "factor_table_has_no_rows" as const, worksheetName: "Analysis-A", tableId: "table-a" }],
        summary: { ...baseRequest(1).requiredFieldCheck.summary, blockingIssueCount: 1 },
      },
      exceptionResolution: { ...baseRequest(1).exceptionResolution, workbookContentHash: "d".repeat(64) },
    };

    expectTypedErrorCode(() => createCalculation({ ...blockedRequest, inputClassification: "public" }), "policy_denied");
    expectTypedErrorCode(() => createCalculation({ ...blockedRequest, requiredFieldCheck: "malformed" }), "validation_error");
    expectTypedErrorCode(() => createCalculation(blockedRequest), "evidence_mismatch");
    expectTypedErrorCode(() => createCalculation({
      ...blockedRequest,
      exceptionResolution: baseRequest(1).exceptionResolution,
    }), "prerequisite_not_ready");
    expectTypedErrorCode(() => createCalculation({
      ...baseRequest(1),
      systemSpecification: {
        ...baseRequest(1).systemSpecification,
        upperSpecLimit: -3,
        lowerSpecLimit: -3,
      },
    }), "calculation_not_possible");
    expectTypedErrorCode(() => createCalculation({ ...baseRequest(1), worksheetSelection: { worksheetName: "Analysis-A", tableId: "missing-table" } }), "validation_error");
  });

  it("classifies finite invalid system specification ranges as calculation_not_possible", () => {
    const request = baseRequest(1);

    expectTypedErrorCode(() => createCalculation({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        upperSpecLimit: -3,
        lowerSpecLimit: -3,
      },
    }), "calculation_not_possible");

    expectTypedErrorCode(() => createCalculation({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        targetSigmaLevel: 0,
      },
    }), "calculation_not_possible");

    expectTypedErrorCode(() => createCalculation({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        targetCpk: 0,
      },
    }), "calculation_not_possible");
  });

  it("keeps unknown, missing, and wrong-type system specification fields as validation_error", () => {
    const request = baseRequest(1);

    expectTypedErrorCode(() => createCalculation({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetCpk: "1" as any,
      },
    }), "validation_error");

    const missingTargetSigmaLevel = deepClone(request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (missingTargetSigmaLevel.systemSpecification as any).targetSigmaLevel;
    expectTypedErrorCode(() => createCalculation(missingTargetSigmaLevel), "validation_error");

    expectTypedErrorCode(() => createCalculation({
      ...request,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      systemSpecification: "invalid" as any,
    }), "validation_error");
  });

  it("prioritizes evidence mismatch and prerequisite blockers ahead of calculability range classification", () => {
    const request = baseRequest(1);

    expectTypedErrorCode(() => createCalculation({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        targetSigmaLevel: 0,
      },
      requiredFieldCheck: {
        ...request.requiredFieldCheck,
        workbookContentHash: "b".repeat(64),
      },
    }), "evidence_mismatch");

    expectTypedErrorCode(() => createCalculation({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        targetSigmaLevel: 0,
      },
      requiredFieldCheck: {
        ...request.requiredFieldCheck,
        status: "blocked",
        blockingIssues: [{ issueCode: "factor_table_has_no_rows", worksheetName: "Analysis-A", tableId: "table-a" }],
        summary: { ...request.requiredFieldCheck.summary, blockingIssueCount: 1 },
      },
    }), "prerequisite_not_ready");
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

  it("rejects unavailable, non-finite and unknown distribution rows", () => {
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

  });

  it("rejects rows when no non-empty unit declaration exists", () => {
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
                unit: availableText("", "Analysis-A!H2"),
                nominalValue: { ...availableNumber("0", "Analysis-A!B2", 0), unit: "   " },
                upperTolerance: { ...availableNumber("1", "Analysis-A!C2", 1), unit: undefined },
                lowerTolerance: { ...availableNumber("-1", "Analysis-A!D2", -1), unit: undefined },
                longTermSafetyFactor: { ...availableNumber("1", "Analysis-A!E2", 1), unit: "" },
                standardDeviation: { ...availableNumber("1", "Analysis-A!F2", 1), unit: undefined },
              },
            }],
          }],
        }],
      },
    }));
  });

  it("rejects rows when explicit unit conflicts with numeric-unit declarations after trim", () => {
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
                unit: availableText(" inch ", "Analysis-A!H2"),
                nominalValue: availableNumber("0", "Analysis-A!B2", 0, " mm "),
                upperTolerance: availableNumber("1", "Analysis-A!C2", 1, "mm"),
                lowerTolerance: availableNumber("-1", "Analysis-A!D2", -1, " mm"),
              },
            }],
          }],
        }],
      },
    }));
  });

  it("rejects mixed units across factors after normalization", () => {
    const request = baseRequest(2);

    expectValidationError(() => createCalculation({
      ...request,
      worksheetAnalysisAssets: {
        ...request.worksheetAnalysisAssets,
        worksheets: [{
          ...request.worksheetAnalysisAssets.worksheets[0],
          factorTables: [{
            ...request.worksheetAnalysisAssets.worksheets[0]!.factorTables[0],
            rows: [
              {
                sourceRow: 2,
                fields: {
                  ...factorFields(0),
                  unit: availableText("mm", "Analysis-A!H2"),
                },
              },
              {
                sourceRow: 3,
                fields: {
                  ...factorFields(1),
                  unit: availableText("in", "Analysis-A!H3"),
                  nominalValue: availableNumber("0", "Analysis-A!B3", 0, "in"),
                  upperTolerance: availableNumber("1", "Analysis-A!C3", 1, "in"),
                  lowerTolerance: availableNumber("-1", "Analysis-A!D3", -1, "in"),
                  longTermSafetyFactor: availableNumber("1", "Analysis-A!E3", 1, "in"),
                  standardDeviation: availableNumber("1", "Analysis-A!F3", 1, "in"),
                },
              },
            ],
          }],
        }],
      },
    }));
  });

  it("accepts factors when all normalized units are consistent", () => {
    const request = baseRequest(2);
    const result = createCalculation(request);

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;

    expect(result.factors.map((factor) => factor.unit)).toEqual(["mm", "mm"]);
  });

  it("rejects selected table with more than 100 rows before reading row fields and without marker leakage", () => {
    const marker = "row-field-getter-should-not-run";
    const request = baseRequest(101);
    const selectedTable = request.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!;
    const firstRow = selectedTable.rows[0]!;
    const fieldsWithThrowingGetter = { ...firstRow.fields };
    Object.defineProperty(fieldsWithThrowingGetter, "nominalValue", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error(marker);
      },
    });
    selectedTable.rows[0] = {
      ...firstRow,
      fields: fieldsWithThrowingGetter,
    };

    const error = captureThrown(() => createCalculation(request));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Calculation request is invalid.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    expectNoMarkerLeak(error, marker);
  });

  it("maps kernel zero RSS failure to calculation_not_possible without leaking sensitive text", () => {
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
      code: "calculation_not_possible",
      summary: "Calculation cannot be completed.",
      affectedInputReferences: ["calculation-request-v1"],
    });
    const typed = error as Error & { summary?: string; message?: string; suggestedAction?: string; affectedInputReferences?: string[] };
    expect(typed.summary ?? "").not.toContain(marker);
    expect(typed.message ?? "").not.toContain(marker);
    expect(typed.suggestedAction ?? "").not.toContain(marker);
    expect((typed.affectedInputReferences ?? []).join(" ")).not.toContain(marker);
  });

  it("emits complete trace coverage and formula-accurate dependency source cells for computed outputs", () => {
    const result = createCalculation(baseRequest(2));

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;

    const outputFields = new Set(result.traceRecords.map((record) => record.outputField));
    const expectedOutputFields = new Set([
      "factors[0].mean",
      "factors[0].halfTolerance",
      "factors[0].sigma",
      "factors[0].contribution",
      "factors[1].mean",
      "factors[1].halfTolerance",
      "factors[1].sigma",
      "factors[1].contribution",
      "system.mean",
      "system.worstCaseUpper",
      "system.worstCaseLower",
      "system.rssSigma",
      "capability.cp",
      "capability.lowerCpk",
      "capability.upperCpk",
      "capability.cpk",
      "capability.lowerZ",
      "capability.upperZ",
      "capability.lowerDpm",
      "capability.upperDpm",
      "capability.totalDpm",
      "capability.outOfSpecRatio",
      "capability.yield",
      "capability.status",
    ]);

    expect(outputFields).toEqual(expectedOutputFields);

    const expectedSigmaInputs = new Set([
      "Analysis-A!C2",
      "Analysis-A!D2",
      "Analysis-A!E2",
      "Analysis-A!F2",
      "Analysis-A!G2",
      "Analysis-A!C3",
      "Analysis-A!D3",
      "Analysis-A!E3",
      "Analysis-A!F3",
      "Analysis-A!G3",
    ]);

    const trace = new Map(result.traceRecords.map((record) => [record.outputField, record]));

    const factor0Mean = trace.get("factors[0].mean");
    const factor1Mean = trace.get("factors[1].mean");
    const factor0Contribution = trace.get("factors[0].contribution");
    const systemMean = trace.get("system.mean");
    const cp = trace.get("capability.cp");
    const lowerDpm = trace.get("capability.lowerDpm");
    const status = trace.get("capability.status");

    expect(factor0Mean).toBeDefined();
    expect(factor1Mean).toBeDefined();
    expect(factor0Contribution).toBeDefined();
    expect(systemMean).toBeDefined();
    expect(cp).toBeDefined();
    expect(lowerDpm).toBeDefined();
    expect(status).toBeDefined();

    expect(new Set(factor0Mean?.sourceCells ?? [])).toEqual(new Set(["Analysis-A!B2", "Analysis-A!C2", "Analysis-A!D2"]));
    expect(new Set(factor1Mean?.sourceCells ?? [])).toEqual(new Set(["Analysis-A!B3", "Analysis-A!C3", "Analysis-A!D3"]));
    expect(new Set(factor0Contribution?.sourceCells ?? [])).toEqual(expectedSigmaInputs);

    expect(new Set(systemMean?.sourceCells ?? [])).toEqual(new Set([
      "Analysis-A!B2",
      "Analysis-A!C2",
      "Analysis-A!D2",
      "Analysis-A!B3",
      "Analysis-A!C3",
      "Analysis-A!D3",
      "request:systemSpecification.additionalMeanShift",
    ]));

    expect(new Set(cp?.sourceCells ?? [])).toEqual(new Set([
      "request:systemSpecification.lowerSpecLimit",
      "request:systemSpecification.upperSpecLimit",
      "system.rssSigma",
    ]));
    expect(cp?.sourceCells).not.toContain("system.mean");
    expect(cp?.sourceCells).not.toContain("request:systemSpecification.targetSigmaLevel");
    expect(cp?.sourceCells).not.toContain("request:systemSpecification.targetCpk");

    expect(new Set(lowerDpm?.sourceCells ?? [])).toEqual(new Set([
      "request:systemSpecification.lowerSpecLimit",
      "system.mean",
      "system.rssSigma",
    ]));
    expect(lowerDpm?.sourceCells).not.toContain("request:systemSpecification.upperSpecLimit");

    expect(new Set(status?.sourceCells ?? [])).toEqual(new Set([
      "request:systemSpecification.lowerSpecLimit",
      "request:systemSpecification.upperSpecLimit",
      "system.mean",
      "system.rssSigma",
      "request:systemSpecification.targetCpk",
    ]));
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
