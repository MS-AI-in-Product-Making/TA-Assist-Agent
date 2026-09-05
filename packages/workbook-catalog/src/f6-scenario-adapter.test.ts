import type {
  CalculationCompletedResult,
  CalculationRequest,
  F6ControlledScenario,
} from "@ai-assist/contracts";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as packageRoot from "./index.js";
import { calculateF6Scenario } from "./f6-scenario-adapter.js";

const CONTENT_HASH = "a".repeat(64);

function availableText(rawText: string, sourceCell: string) {
  return { status: "available" as const, rawText, sourceCell };
}

function availableNumber(rawText: string, sourceCell: string, numericValue: number) {
  return { status: "available" as const, rawText, sourceCell, numericValue, unit: "mm" };
}

function baselineRequest() {
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
          dataRange: { startRow: 2, endRow: 2 },
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
          rows: [{
            sourceRow: 2,
            fields: {
              factorName: availableText("factor-1", "Analysis-A!A2"),
              nominalValue: availableNumber("0", "Analysis-A!B2", 0),
              upperTolerance: availableNumber("1", "Analysis-A!C2", 1),
              lowerTolerance: availableNumber("-1", "Analysis-A!D2", -1),
              longTermSafetyFactor: availableNumber("1", "Analysis-A!E2", 1),
              standardDeviation: availableNumber("1", "Analysis-A!F2", 1),
              distribution: availableText("normal", "Analysis-A!G2"),
              unit: availableText("mm", "Analysis-A!H2"),
            },
          }],
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
        factorRowsChecked: 1,
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
      targetCpk: 1,
      additionalMeanShift: 0,
    },
    criticality: "none" as const,
    scenarioOverrides: [],
  };
}

function factorScenario(overrides: Record<string, unknown> = {}) {
  return {
    scenarioId: "f6-factor-scenario",
    optionKind: "reduce_top_contributor_20" as const,
    factorOverrides: [{
      worksheetName: "Analysis-A",
      tableId: "table-a",
      sourceRow: 2,
      nominalValue: 0.1,
      upperTolerance: 0.8,
      lowerTolerance: -0.8,
      longTermSafetyFactor: 1.2,
      sigmaLevel: 4,
      distribution: "uniform" as const,
    }],
    ...overrides,
  };
}

function captureError(action: () => unknown): unknown {
  try {
    action();
    return undefined;
  } catch (error) {
    return error;
  }
}

function expectControlledError(
  action: () => unknown,
  code: string,
  reference = "f6-controlled-scenario-v1",
): unknown {
  const error = captureError(action);
  expect(error).toMatchObject({
    code,
    affectedInputReferences: [reference],
  });
  return error;
}

describe("calculateF6Scenario", () => {
  it("exposes the governed request, scenario, and completed result types", () => {
    expectTypeOf(calculateF6Scenario).parameter(0).toEqualTypeOf<{
      readonly baselineRequest: CalculationRequest;
      readonly scenario: F6ControlledScenario;
    }>();
    expectTypeOf(calculateF6Scenario).returns.toEqualTypeOf<CalculationCompletedResult>();
  });

  it("runs a valid factor override through F4 and preserves governed identity and trace", () => {
    const baseline = baselineRequest();
    const result = calculateF6Scenario({ baselineRequest: baseline, scenario: factorScenario() });

    expect(result.status).toBe("completed");
    expect(result.workbookContentHash).toBe(CONTENT_HASH);
    expect(result.worksheetSelection).toEqual(baseline.worksheetSelection);
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]).toMatchObject({
      scenarioId: "f6-factor-scenario",
      baselineRunReference: baseline.runReference,
      overrides: {
        factors: [{
          source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
          fields: ["nominalValue", "upperTolerance", "lowerTolerance", "longTermSafetyFactor", "sigmaLevel", "distribution"],
        }],
      },
    });
    expect(result.scenarios[0]?.calculation.traceRecords.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.scenarios[0]?.calculation.traceRecords)).toContain("scenarioOverrides[0]");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.scenarios[0]?.calculation.traceRecords)).toBe(true);
  });

  it("runs a valid system override and preserves an existing baseline scenario", () => {
    const baseline = baselineRequest();
    baseline.scenarioOverrides.push({
      scenarioId: "existing",
      factorOverrides: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, sigmaLevel: 3 }],
    });

    const result = calculateF6Scenario({
      baselineRequest: baseline,
      scenario: {
        scenarioId: "f6-system-scenario",
        optionKind: "mean_shift_centering",
        factorOverrides: [],
        systemSpecification: { additionalMeanShift: 0.25, targetCpk: 1.33 },
      },
    });

    expect(result.scenarios.map((entry) => entry.scenarioId)).toEqual(["existing", "f6-system-scenario"]);
    expect(result.scenarios[1]?.overrides.systemSpecification).toEqual({ additionalMeanShift: 0.25, targetCpk: 1.33 });
  });

  it("runs a nominal-only factor override without introducing tolerance field changes", () => {
    const baseline = baselineRequest();

    const result = calculateF6Scenario({
      baselineRequest: baseline,
      scenario: {
        scenarioId: "f6-nominal-only",
        optionKind: "requirement_change",
        factorOverrides: [{
          worksheetName: "Analysis-A",
          tableId: "table-a",
          sourceRow: 2,
          nominalValue: 0.75,
        }],
      },
    });

    const scenario = result.scenarios.find(({ scenarioId }) => scenarioId === "f6-nominal-only");
    expect(scenario?.overrides).toEqual({
      factors: [{
        source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
        fields: ["nominalValue"],
      }],
    });
    const scenarioCalculation = scenario?.calculation;
    expect(scenarioCalculation?.factors[0]!.input.nominalValue).toBe(0.75);
    expect(scenarioCalculation?.factors[0]!.input.lowerTolerance).toBe(-1);
    expect(scenarioCalculation?.factors[0]!.input.upperTolerance).toBe(1);
  });

  it("runs a one-sided system specification override", () => {
    const baseline = baselineRequest();
    const result = calculateF6Scenario({
      baselineRequest: baseline,
      scenario: {
        scenarioId: "f6-system-lsl-only",
        optionKind: "requirement_change",
        factorOverrides: [],
        systemSpecification: { lowerSpecLimit: -2.5 },
      },
    });

    const scenario = result.scenarios.find(({ scenarioId }) => scenarioId === "f6-system-lsl-only");
    expect(scenario?.overrides).toEqual({
      factors: [],
      systemSpecification: { lowerSpecLimit: -2.5 },
    });
    const scenarioCalculation = scenario?.calculation;
    expect(scenarioCalculation?.capability.lowerSpecLimit).toBe(-2.5);
    expect(scenarioCalculation?.capability.upperSpecLimit).toBe(3);
  });

  it.each([
    ["worksheet", { factorOverrides: [{ ...factorScenario().factorOverrides[0], worksheetName: "Other" }] }],
    ["table", { factorOverrides: [{ ...factorScenario().factorOverrides[0], tableId: "other-table" }] }],
    ["row", { factorOverrides: [{ ...factorScenario().factorOverrides[0], sourceRow: 99 }] }],
  ])("rejects a source %s mismatch without leaking raw input", (_label, overrides) => {
    const marker = "RAW-CONFIDENTIAL-MARKER";
    const baseline = { ...baselineRequest(), projectReference: marker };
    const error = expectControlledError(
      () => calculateF6Scenario({ baselineRequest: baseline, scenario: factorScenario(overrides) }),
      "evidence_mismatch",
    );
    expect(JSON.stringify(error)).not.toContain(marker);
  });

  it("rejects duplicate factor source keys and duplicate scenario IDs", () => {
    const duplicateOverride = factorScenario().factorOverrides[0];
    expectControlledError(() => calculateF6Scenario({
      baselineRequest: baselineRequest(),
      scenario: factorScenario({ factorOverrides: [duplicateOverride, { ...duplicateOverride, sigmaLevel: 5 }] }),
    }), "validation_error");

    const baseline = baselineRequest();
    baseline.scenarioOverrides.push({
      scenarioId: "f6-factor-scenario",
      factorOverrides: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, sigmaLevel: 3 }],
    });
    expectControlledError(() => calculateF6Scenario({ baselineRequest: baseline, scenario: factorScenario() }), "validation_error");
  });

  it("rejects public, multi-worksheet, disallowed, and unknown scenario input", () => {
    expectControlledError(() => calculateF6Scenario({
      baselineRequest: { ...baselineRequest(), inputClassification: "public" },
      scenario: factorScenario(),
    }), "policy_denied");

    const multiWorksheet = baselineRequest();
    multiWorksheet.worksheetAnalysisAssets.worksheets.push(structuredClone(multiWorksheet.worksheetAnalysisAssets.worksheets[0]!));
    expectControlledError(() => calculateF6Scenario({ baselineRequest: multiWorksheet, scenario: factorScenario() }), "validation_error");

    const scenario = factorScenario();
    expectControlledError(() => calculateF6Scenario({
      baselineRequest: baselineRequest(),
      scenario: { ...scenario, secretField: "not-allowed" },
    }), "validation_error");
    expectControlledError(() => calculateF6Scenario({
      baselineRequest: baselineRequest(),
      scenario: { ...scenario, factorOverrides: [{ ...scenario.factorOverrides[0], standardDeviation: 0.2 }] },
    }), "validation_error");
  });

  it.each(["baselineRequest", "scenario"] as const)(
    "contains a throwing %s getter without leaking its marker",
    (property) => {
      const marker = `RAW-${property}-GETTER-MARKER`;
      const input = {
        baselineRequest: baselineRequest(),
        scenario: factorScenario(),
      };
      Object.defineProperty(input, property, {
        enumerable: true,
        get() {
          throw new Error(marker);
        },
      });

      const error = expectControlledError(
        () => calculateF6Scenario(input as unknown as Parameters<typeof calculateF6Scenario>[0]),
        "validation_error",
      );
      expect(JSON.stringify(error)).not.toContain(marker);
      expect(String(error)).not.toContain(marker);
    },
  );

  it("contains nested getters and proxies without leaking raw markers", () => {
    const getterMarker = "RAW-NESTED-GETTER-MARKER";
    const proxyMarker = "RAW-PROXY-MARKER";
    const baseline = baselineRequest();
    Object.defineProperty(baseline, "worksheetAnalysisAssets", {
      enumerable: true,
      get() {
        throw new Error(getterMarker);
      },
    });
    const getterError = expectControlledError(
      () => calculateF6Scenario({
        baselineRequest: baseline,
        scenario: factorScenario(),
      } as unknown as Parameters<typeof calculateF6Scenario>[0]),
      "validation_error",
    );
    expect(JSON.stringify(getterError)).not.toContain(getterMarker);

    const scenario = new Proxy(factorScenario(), {
      ownKeys() {
        throw new Error(proxyMarker);
      },
    });
    const proxyError = expectControlledError(
      () => calculateF6Scenario({
        baselineRequest: baselineRequest(),
        scenario,
      } as unknown as Parameters<typeof calculateF6Scenario>[0]),
      "validation_error",
    );
    expect(JSON.stringify(proxyError)).not.toContain(proxyMarker);
  });

  it("rejects factor override arrays above the schema maximum", () => {
    const oversizedOverrides = Array.from(
      { length: 101 },
      () => ({ ...factorScenario().factorOverrides[0] }),
    );
    expectControlledError(() => calculateF6Scenario({
      baselineRequest: baselineRequest(),
      scenario: factorScenario({ factorOverrides: oversizedOverrides }),
    } as unknown as Parameters<typeof calculateF6Scenario>[0]), "validation_error");
  });

  it("preserves the trusted validation code for an invalid existing scenario source", () => {
    const baseline = baselineRequest();
    baseline.scenarioOverrides.push({
      scenarioId: "existing-invalid-source",
      factorOverrides: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 999,
        sigmaLevel: 3,
      }],
    });

    expectControlledError(() => calculateF6Scenario({
      baselineRequest: baseline,
      scenario: factorScenario(),
    }), "validation_error", "calculation-request-v1");
  });

  it("maps unknown internal exceptions without leaking their marker", () => {
    const marker = "RAW-INTERNAL-EXCEPTION-MARKER";
    const values = vi.spyOn(Object, "values").mockImplementationOnce(() => {
      throw new Error(marker);
    });
    try {
      const error = expectControlledError(() => calculateF6Scenario({
        baselineRequest: baselineRequest(),
        scenario: factorScenario(),
      }), "internal_error");
      expect(JSON.stringify(error)).not.toContain(marker);
      expect(String(error)).not.toContain(marker);
    } finally {
      values.mockRestore();
    }
  });

  it("does not mutate baseline or scenario and returns a detached result", () => {
    const baseline = baselineRequest();
    const scenario = factorScenario();
    const baselineBefore = structuredClone(baseline);
    const scenarioBefore = structuredClone(scenario);

    const result = calculateF6Scenario({ baselineRequest: baseline, scenario });

    expect(baseline).toEqual(baselineBefore);
    expect(scenario).toEqual(scenarioBefore);
    expect(result.scenarios).not.toBe(baseline.scenarioOverrides);
    expect(() => {
      (result.scenarios as unknown as Array<unknown>).push({});
    }).toThrow();
  });

  it("converts a downstream F4 rejection into a controlled calculation error", () => {
    const marker = "RAW-SCENARIO-MARKER";
    const error = expectControlledError(() => calculateF6Scenario({
      baselineRequest: baselineRequest(),
      scenario: {
        scenarioId: marker,
        optionKind: "requirement_change",
        factorOverrides: [],
        systemSpecification: { lowerSpecLimit: 4 },
      },
    }), "calculation_not_possible", "calculation-request-v1");

    expect(JSON.stringify(error)).not.toContain(marker);
  });

  it("exports only the governed adapter surface from the package root", () => {
    expect(packageRoot.calculateF6Scenario).toBe(calculateF6Scenario);
    expect(packageRoot).not.toHaveProperty("createScenarioEntry");
    expect(packageRoot).not.toHaveProperty("applyScenarioFactorOverride");
    expect(packageRoot).not.toHaveProperty("calculateToleranceAnalysis");
  });
});